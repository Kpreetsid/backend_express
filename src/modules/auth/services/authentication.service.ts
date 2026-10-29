import mongoose from "mongoose";
import { IUser, UserModel, UserLoginPayload } from "../../users/models/user.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../../common/utils/bcrypt.helper';
import { generateAccessToken } from '../../../core/auth/auth.middleware';
import { getAccessTokenTypeFilter, TokenModel } from "../models/userToken.model";
import { rolesService } from "../../users/services/roles.service";
import { resetPasswordService } from './resetPassword.service';
import { auth, supportLogin } from "../../../core/config/env.config";
import { helperService } from "../../../common/utils/helper";
import { IAccount } from "../../company/models/account.model";
import { companyService } from "../../company/services/company.service";
import { get } from "lodash";
import { mapUserToLocationService } from "../../mappings/services/userLocation.service";
import { TokenBlacklist } from "../../../core/auth/token-blacklist";
import { refreshTokenService } from "./refreshToken.service";
import { parseTtlSeconds } from "../../../common/utils/ttl.helper";
import { accountAccessService } from "../../users/services/account-access.service";
import { tokenSessionStore } from "../../../core/auth/token-session-store";
import { clearAuthCookies, setAccessCookies } from "../../../core/auth/auth-cookie.service";
import { analysisFeatureService } from "../../settings/services/analysisFeature.service";
import { passwordExpiryNotice } from './password-expiry';
import { EXTERNAL_LOGIN_GRANT_TTL_SECONDS, consumeExternalLoginGrant, issueExternalLoginGrant, resolveSupportEnvironment } from './external-login-grant.service';
import { authorizeSupportActor } from './support-login-actor.service';

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

export const userAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const sessionStartedAt = Date.now();
    const restrictedRoles = ['manager', 'employee', 'customer', 'user'];
    const { username, password } = req.body;
    if (!username || !password) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { $or: [{ username: username }, { email: username }], user_status: 'active' };
    const user: IUser | null = await UserModel.findOne(match).select('+password');
    if (!user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const accountMatch = { _id: user.account_id };
    const userAccount: IAccount[] | null = await companyService.getAllCompanies(accountMatch);
    if (!userAccount || userAccount.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const isMatch = await passwordService.comparePassword(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    if (!user.isVerified) {
      throw Object.assign(new Error("Unverified user"), { status: 403 });
    }
    const getFirstUser = await UserModel.findOne({ account_id: user.account_id, isFirstUser: true, user_status: 'active' });
    if (!getFirstUser) {
      throw Object.assign(new Error('Your account has been locked. Please contact support team.'), { status: 401 });
    }
    if (restrictedRoles.includes(user.user_role)) {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const token_id = new mongoose.Types.ObjectId();
    const userTokenPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id), jti: String(token_id), sessionStartedAt };
    const token = generateAccessToken(userTokenPayload);
    if (!await rolesService.verifyUserRole(String(user._id), String(user.account_id))) {
      await rolesService.createUserRole(user.user_role, user);
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
    await refreshTokenService.issueForUser(req, res, user, token_id, new Date(sessionStartedAt));

    // Cookie-backed browser login is mandatory for every eligible account.
    // Keep the legacy response token temporarily for existing clients until the
    // Angular browser credential migration removes token consumption.
    setAccessCookies(res, {
      token,
      tokenId: String(token_id),
      userId: String(user._id),
      accountId: String(user.account_id),
      ttlSeconds: accessTtlSeconds
    });
    res.status(200).json({
      status: true,
      message: 'Login successful',
      data: {
        ...passwordExpiryNotice(user.passwordExpiredAt),
        authMethod: 'cookie',
        token_id,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const sessionStartedAt = Date.now();
    const { username, password } = req.body;
    if (!username || !password) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { $or: [{ username: username }, { email: username }], user_status: 'active' };
    const user: IUser | null = await UserModel.findOne(match).select('+password');
    if (!user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const accountMatch = { _id: user.account_id };
    const userAccount: IAccount[] | null = await companyService.getAllCompanies(accountMatch);
    if (!userAccount || userAccount.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const isMatch = await passwordService.comparePassword(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    if (user.user_role !== 'admin') {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const token_id = new mongoose.Types.ObjectId();
    const userTokenPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id), jti: String(token_id), sessionStartedAt };
    const token = generateAccessToken(userTokenPayload);
    let userRoleData: any = await rolesService.verifyUserRole(String(user._id), String(user.account_id));
    if (!userRoleData) {
      userRoleData = await rolesService.createUserRole(user.user_role, user);
    }
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const accessTtlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const expiresAt = new Date(Date.now() + accessTtlSeconds * 1000);
    const userTokenData = new TokenModel({
      _id: token,
      tokenType: 'access',
      token_id,
      userId: user._id,
      account_id: user.account_id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    await persistAccessSession(token, token_id, user, accessTtlSeconds, expiresAt);
    const refreshSession = await refreshTokenService.issueForUser(req, res, user, token_id, new Date(sessionStartedAt));
    // Machine-token authentication is a separate compatibility contract.
    res.status(200).json({
      status: true,
      message: 'Login successful',
      data: {
        ...passwordExpiryNotice(user.passwordExpiredAt),
        token,
        token_id,
        refreshToken: refreshSession.rawToken,
        org_id: user.account_id,
        user_id: user._id
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const identifier = String(req.body?.email || '').trim().toLowerCase();
    const companyId = String(req.body?.company_id || '').trim();
    const actorId = String(req.body?.actor_id || '').trim();
    const stateChallenge = String(req.body?.state_challenge || '').trim();
    const environment = resolveSupportEnvironment(req.body?.environment);

    if (!identifier || !companyId || !actorId || stateChallenge.length < 32) {
      throw Object.assign(new Error('Complete support login context is required'), { status: 400 });
    }

    const accountId = helperService.validateObjectId(companyId);
    await authorizeSupportActor({ actorId, companyId: String(accountId), environment });

    const externalUser = await UserModel.findOne({
      email: identifier,
      account_id: accountId,
      user_status: 'active',
      visible: { $ne: false }
    });
    if (!externalUser) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }

    const grant = await issueExternalLoginGrant({
      actorId,
      targetUserId: externalUser._id as mongoose.Types.ObjectId,
      companyId: externalUser.account_id as mongoose.Types.ObjectId,
      environment,
      stateChallenge
    });

    return res.status(200).json({
      status: true,
      message: 'Login grant created',
      data: {
        external_token: grant.code,
        org_id: externalUser.account_id,
        user_id: externalUser._id,
        expires_in: EXTERNAL_LOGIN_GRANT_TTL_SECONDS
      }
    });
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const externalToken = String(req.body?.external_token || '').trim();
    const stateProof = String(req.body?.state_proof || '').trim();
    if (!externalToken || stateProof.length < 32) {
      throw Object.assign(new Error('External login grant and browser state are required'), { status: 400 });
    }

    const environment = resolveSupportEnvironment(supportLogin.environment);
    const consumedGrant = await consumeExternalLoginGrant(externalToken, stateProof, environment);
    if (!consumedGrant) {
      throw Object.assign(new Error('Support login grant is expired, invalid, or already used'), { status: 401 });
    }

    await authorizeSupportActor({
      actorId: consumedGrant.actorId,
      companyId: String(consumedGrant.companyId),
      environment
    });

    const userDetails = await UserModel.findOne({
      _id: consumedGrant.targetUserId,
      account_id: consumedGrant.companyId,
      user_status: 'active',
      visible: { $ne: false }
    });
    if (!userDetails) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const accountDetails = await companyService.getAllCompanies({ _id: userDetails.account_id });
    if (!accountDetails || accountDetails.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    if (!await rolesService.verifyUserRole(String(userDetails._id), String(userDetails.account_id))) {
      await rolesService.createUserRole(userDetails.user_role, userDetails);
    }
    const token_id = new mongoose.Types.ObjectId();
    const userTokenPayload: UserLoginPayload = { id: String(userDetails._id), username: userDetails.username, companyID: String(userDetails.account_id), jti: String(token_id) };
    const newToken = generateAccessToken(userTokenPayload);
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const accessTtlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const expiresAt = new Date(Date.now() + accessTtlSeconds * 1000);
    const userTokenData = new TokenModel({
      _id: newToken,
      tokenType: 'access',
      token_id,
      userId: userDetails._id,
      account_id: userDetails.account_id,
      principalType: 'user',
      isExternal: true,
      isInternal: true,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    await persistAccessSession(newToken, token_id, userDetails, accessTtlSeconds, expiresAt, { isExternal: true, isInternal: true });
    await refreshTokenService.issueForUser(req, res, userDetails, token_id);
    const safeRedirectPath = '/dashboard';
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: userDetails.account_id });

    setAccessCookies(res, {
      token: newToken,
      tokenId: String(token_id),
      userId: String(userDetails._id),
      accountId: String(userDetails.account_id),
      ttlSeconds: accessTtlSeconds
    });

    return res.status(200).json({
      status: true,
      message: 'Login successful',
      data: {
        authMethod: 'cookie',
        token_id,
        token: newToken,
        isExternal: true,
        isInternal: true,
        redirectPath: safeRedirectPath,
        analysisFeature
      }
    });
  } catch (error) {
    next(error);
  }
};

export const userResetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { token, password, email, confirmNewPassword } = req.body;
    await resetPasswordService.completeReset({ token, password, email, confirmation: confirmNewPassword });
    clearAuthCookies(res);
    refreshTokenService.clearCookie(res);
    return res.status(200).json({ status: true, message: 'Password reset successful' });

  } catch (error) {
    next(error);
  }
};


export const userLogOutService = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user_id = get(req, 'user_id');
    const userToken = String(get(req, 'userToken') || '');

    // Remove token from MongoDB
    const [accessToken] = await Promise.all([
      TokenModel.deleteMany({
        _id: userToken,
        userId: { $exists: true },
        ...getAccessTokenTypeFilter()
      }),
      // TokenModel.deleteMany({ _id: { $exists: true }, userId: helperService.validateObjectId(user_id) })
    ]);
    console.log({ accessToken, user_id });

    // Blacklist the JWT in Redis so it cannot be reused before natural expiry
    if (userToken) {
      try {
        const remainingTtl = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
        await TokenBlacklist.add(userToken, remainingTtl);
      } catch (blacklistErr) {
        // Non-fatal: if Redis is down, token is still removed from MongoDB
        console.warn('[Logout] JWT blacklisting failed (non-fatal):', blacklistErr);
      }
    }
    await tokenSessionStore.deleteAccessSession(userToken);
    await refreshTokenService.revokeCurrent(req, res);

    clearAuthCookies(res);

    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

export const userGetMeService = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, 'user', {}) as any;
    const accountId = String(get(req, 'companyID') || user.account_id || '');
    const userId = String(user._id || user.id || '');

    if (!userId || !accountId) {
      throw Object.assign(new Error('Invalid authenticated session'), { status: 401 });
    }

    const accountDetails = await companyService.getAllCompanies({ _id: helperService.validateObjectId(accountId) });
    if (!accountDetails || accountDetails.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }

    let userRoleData: any = await rolesService.verifyUserRole(userId, accountId);
    if (!userRoleData) {
      const userDocument = await UserModel.findOne({ _id: helperService.validateObjectId(userId), account_id: helperService.validateObjectId(accountId), user_status: 'active' });
      if (!userDocument) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      userRoleData = await rolesService.createUserRole(userDocument.user_role, userDocument);
    }

    const { password: _, ...safeUser } = user;
    safeUser.id = safeUser._id || safeUser.id;
    const effectivePermissions = await accountAccessService.getEffectivePermissionsForUser(user, userRoleData, accountDetails[0]);
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: user.account_id })

    const userToken = String(get(req, 'userToken') || '');
    return res.status(200).json({
      status: true,
      data: {
        authMethod: 'cookie',
        token: userToken,
        accountDetails: accountDetails[0],
        userDetails: safeUser,
        platformControl: effectivePermissions.platformControl,
        roleMenu: effectivePermissions.roleMenu,
        accountPermissionVersion: Number(accountDetails[0].account_permission_version || 1),
        analysisFeature: analysisFeature,
        isExternal: !!get(req, 'authFlags.isExternal'),
        isInternal: !!get(req, 'authFlags.isInternal')
      }
    });
  } catch (error) {
    next(error);
  }
};
