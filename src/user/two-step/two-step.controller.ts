import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { IUser, UserModel } from '../../models/user.model';
import { IAccount } from '../../models/account.model';
import { TokenModel } from '../../models/userToken.model';
import { generateAccessToken } from '../../_config/auth';
import { auth } from '../../configDB';
import { rolesService } from '../../masters/user/role/roles.service';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { tokenSessionStore } from '../../_cache/session/tokenSessionStore';
import { accountAccessService } from '../../_role/accountAccess.service';
import { analysisFeatureService } from '../../masters/analysisFeature/analysisFeature.service';
import { parseTtlSeconds } from '../../utils/ttl';
import { refreshTokenService } from '../authentication/refreshToken.service';
import { clearAuthCookies, setAccessCookies } from '../authentication/authCookie.service';
import { passwordExpiryNotice } from '../authentication/password-expiry';
import { twoStepService } from './two-step.service';

type PasswordResponseMode = 'login' | 'authenticate';

// Completion for an already consumed login challenge. Legacy password handlers
// remain unchanged apart from their explicit two-step challenge issuance hook.
const persistAccessSession = async (
  token: string,
  tokenId: mongoose.Types.ObjectId,
  user: IUser,
  ttlSeconds: number,
  expiresAt: Date,
  flags: { isExternal?: boolean; isInternal?: boolean } = {}
): Promise<void> => {
  await tokenSessionStore.setAccessSession({
    token,
    tokenId: String(tokenId),
    userId: String(user._id),
    accountId: String(user.account_id || ''),
    principalType: 'user',
    expiresAt: expiresAt.toISOString(),
    ttlSeconds,
    isExternal: flags.isExternal || false,
    isInternal: flags.isInternal || false
  });
};

async function validateTwoStepLoginEligibility(user: IUser, account: IAccount, responseMode: PasswordResponseMode): Promise<void> {
  if (responseMode === 'login') {
    if (!user.isVerified) throw Object.assign(new Error('Unverified user'), { status: 403 });
    const firstUser = await UserModel.findOne({ account_id: user.account_id, isFirstUser: true, user_status: 'active' });
    if (!firstUser) throw Object.assign(new Error('Your account has been locked. Please contact support team.'), { status: 401 });
  }
  const restricted = responseMode === 'authenticate' ? user.user_role !== 'admin'
    : ['manager', 'employee', 'customer', 'user'].includes(user.user_role);
  if (restricted) {
    const locations = await mapUserToLocationService.getLocationsMappedData(user._id);
    if (!locations?.length) throw Object.assign(new Error('User does not have any location'), { status: 401 });
  }
}

async function completeTwoStepSession(req: Request, res: Response, user: IUser, account: IAccount,
  responseMode: PasswordResponseMode, sessionStartedAt: number): Promise<any> {
    const { password: _, ...safeUser } = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    safeUser.id = safeUser._id;
    const token_id = new mongoose.Types.ObjectId();
    const userTokenPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id), jti: String(token_id), sessionStartedAt };
    const token = generateAccessToken(userTokenPayload);
    let userRoleData: any = await rolesService.verifyUserRole(String(user._id), String(user.account_id));
    if (!userRoleData) {
      userRoleData = await rolesService.createUserRole(user.user_role, user);
    }
    const accessTtlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const expiresAt = new Date(Date.now() + accessTtlSeconds * 1000);
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const userTokenData = new TokenModel({
      _id: token,
      tokenType: 'access',
      token_id: token_id,
      userId: user._id,
      account_id: user.account_id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    await persistAccessSession(token, token_id, user, accessTtlSeconds, expiresAt);
    const refreshSession = await refreshTokenService.issueForUser(req, res, user, token_id, new Date(sessionStartedAt));
    const isCookieAuth = account.cookie_status === 'enabled';
    if (responseMode === 'authenticate') {
      return res.status(200).json({ status: true, message: 'Login successful', data: {
        ...passwordExpiryNotice(user.passwordExpiredAt), token, token_id,
        ...(!isCookieAuth ? { refreshToken: refreshSession.rawToken } : {}),
        org_id: user.account_id, user_id: user._id
      } });
    }
    const effectivePermissions = accountAccessService.getEffectivePermissions(userRoleData, account);
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: user.account_id })

    if (isCookieAuth) {
      setAccessCookies(res, {
        token,
        tokenId: String(token_id),
        userId: String(user._id),
        accountId: String(user.account_id),
        ttlSeconds: accessTtlSeconds
      });

      return res.status(200).json({
        status: true,
        message: 'Login successful',
        data: {
          ...passwordExpiryNotice(user.passwordExpiredAt),
          authMethod: 'cookie',
          token_id,
          token
        }
      });
    } else {
      clearAuthCookies(res);
      return res.status(200).json({
        status: true,
        message: 'Login successful',
        data: {
          ...passwordExpiryNotice(user.passwordExpiredAt),
          authMethod: 'localStorage',
          token,
          token_id,
          refreshToken: refreshSession.rawToken,
          accountDetails: account,
          userDetails: safeUser,
          platformControl: effectivePermissions.platformControl,
          roleMenu: effectivePermissions.roleMenu,
          analysisFeature: analysisFeature,
          accountPermissionVersion: Number(account.account_permission_version || 1)
        }
      });
    }
}

export const verifyTwoStepAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    res.setHeader?.('Cache-Control', 'no-store');
    const { user, account, responseMode, sessionStartedAt } = await twoStepService.consume(req.body?.challengeToken, req.body?.code);
    await validateTwoStepLoginEligibility(user, account, responseMode);
    return await completeTwoStepSession(req, res, user, account, responseMode, sessionStartedAt);
  } catch (error) { return next(error); }
};

export const resendTwoStepAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    res.setHeader?.('Cache-Control', 'no-store');
    const data = await twoStepService.resend(req.body?.challengeToken);
    return res.status(202).json({ status: true, message: 'Email verification required', data });
  } catch (error) { return next(error); }
};

