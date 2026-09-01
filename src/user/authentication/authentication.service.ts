import mongoose from "mongoose";
import { IUser, UserModel, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../utils/bcrypt';
import { decryptToken, generateAccessToken, generateExternalAccessToken } from '../../_config/auth';
import { getAccessTokenTypeFilter, TokenModel } from "../../models/userToken.model";
import { rolesService } from "../../masters/user/role/roles.service";
import { MailerService } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { auth } from "../../configDB";
import { helperService } from "../../utils/helper";
import { IAccount, AccountModel } from "../../models/account.model";
import { companyService } from "../../masters/company/company.service";
import { get } from "lodash";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { TokenBlacklist } from "../../_cache/auth/tokenBlacklist";
import { refreshTokenService } from "./refreshToken.service";
import { parseTtlSeconds } from "../../utils/ttl";
import { accountAccessService } from "../../_role/accountAccess.service";
import { tokenSessionStore } from "../../_cache/session/tokenSessionStore";
import { clearAuthCookies, setAccessCookies } from "./authCookie.service";
import { analysisFeatureService } from "../../masters/analysisFeature/analysisFeature.service";

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
    const userTokenPayload: UserLoginPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id), jti: String(token_id) };
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
    const refreshSession = await refreshTokenService.issueForUser(req, res, user, token_id);
    const effectivePermissions = accountAccessService.getEffectivePermissions(userRoleData, userAccount[0]);
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: user.account_id })

    const isCookieAuth = userAccount[0].cookie_status === 'enabled';
    if (isCookieAuth) {
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
          authMethod: 'cookie',
          token_id,
          token
        }
      });
    } else {
      clearAuthCookies(res);
      res.status(200).json({
        status: true,
        message: 'Login successful',
        data: {
          authMethod: 'localStorage',
          token,
          token_id,
          refreshToken: refreshSession.rawToken,
          accountDetails: userAccount[0],
          userDetails: safeUser,
          platformControl: effectivePermissions.platformControl,
          roleMenu: effectivePermissions.roleMenu,
          analysisFeature: analysisFeature,
          accountPermissionVersion: Number(userAccount[0].account_permission_version || 1)
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
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
    const userTokenPayload: UserLoginPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id), jti: String(token_id) };
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
    const refreshSession = await refreshTokenService.issueForUser(req, res, user, token_id);
    const isCookieAuth = userAccount[0].cookie_status === 'enabled';
    res.status(200).json({
      status: true,
      message: 'Login successful',
      data: {
        token,
        token_id,
        ...(!isCookieAuth ? { refreshToken: refreshSession.rawToken } : {}),
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
    const identifier = String(req.params.email || req.params.accountId || req.params.id || '').trim();
    const { type } = req.query;
    if (!identifier) {
      throw Object.assign(new Error('Bad request: identifier is required'), { status: 400 });
    }

    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);

    if (type === 'DOWNLOAD_DATA') {
      if (!mongoose.Types.ObjectId.isValid(identifier)) {
        throw Object.assign(new Error('Invalid account ID for download token'), { status: 400 });
      }

      const account = await AccountModel.findOne({ _id: identifier, visible: true });
      if (!account) {
        throw Object.assign(new Error('Account data not found'), { status: 404 });
      }

      const match: any = {
        org_id: account._id,
        account_name: account.account_name,
        isExternal: false,
        isInternal: false,
        isDownloadData: true,
        type: 'DOWNLOAD_DATA'
      };
      await TokenModel.deleteMany({ account_id: account._id, principalType: 'download_data' });
      const external_token = generateExternalAccessToken(match);
      const downloadDataTtlSeconds = parseTtlSeconds(auth.expiresIn, 365 * 24 * 60 * 60);
      const tokenData = new TokenModel({
        _id: external_token,
        tokenType: 'access',
        token_id: new mongoose.Types.ObjectId(),
        account_id: account._id,
        principalType: 'download_data',
        isExternal: true,
        isInternal: false,
        ttl: downloadDataTtlSeconds,
        expiresAt: new Date(Date.now() + downloadDataTtlSeconds * 1000)
      });
      await tokenData.save();

      return res.status(200).json({
        status: true,
        message: 'Download token generated successfully',
        data: { external_token, account_id: account._id, account_name: account.account_name }
      });
    }

    // Interactive user login token
    const external_user = await UserModel.findOne({ email: identifier, user_status: 'active' });
    if (!external_user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }

    const match: any = {
      email: external_user.email,
      org_id: external_user.account_id,
      isExternal: false,
      isInternal: true
    };
    const external_token = generateExternalAccessToken(match);
    const userTokenData = new TokenModel({
      _id: external_token,
      tokenType: 'access',
      token_id: new mongoose.Types.ObjectId(),
      userId: external_user._id,
      account_id: external_user.account_id,
      principalType: 'user',
      isExternal: true,
      isInternal: false,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();

    return res.status(200).json({
      status: true,
      message: 'Login successful',
      data: { external_token, org_id: external_user.account_id, user_id: external_user._id }
    });
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body: { external_token } } = req;
    if (!external_token) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const decoded = decryptToken(external_token);
    const { email, org_id, isExternal, isInternal, isDownloadData, redirectPath } = decoded;
    if (!email && !org_id) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    if (true === !!isDownloadData) {
      throw Object.assign(new Error(`User can't access this application resource.`), { status: 401 });
    }
    const userDetails = await UserModel.findOne({ email, account_id: helperService.validateObjectId(org_id), user_status: 'active' });
    if (!userDetails) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const { password: _, ...safeUser } = userDetails.toObject();
    const newSafeUserValue: any = { id: safeUser._id, ...safeUser }
    const accountDetails = await companyService.getAllCompanies({ _id: userDetails.account_id });
    if (!accountDetails || accountDetails.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    let userRoleMenu: any = await rolesService.verifyUserRole(String(userDetails._id), String(userDetails.account_id));
    if (!userRoleMenu) {
      userRoleMenu = await rolesService.createUserRole(userDetails.user_role, userDetails);
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
      isExternal,
      isInternal,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    await persistAccessSession(newToken, token_id, userDetails, accessTtlSeconds, expiresAt, { isExternal, isInternal });
    const refreshSession = await refreshTokenService.issueForUser(req, res, userDetails, token_id);
    const safeRedirectPath = typeof redirectPath === 'string' && redirectPath.startsWith('/')
      ? redirectPath
      : '/dashboard';
    const effectivePermissions = accountAccessService.getEffectivePermissions(userRoleMenu, accountDetails[0]);
    const isCookieAuth = accountDetails[0].cookie_status === 'enabled';
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: userDetails.account_id })

    if (isCookieAuth) {
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
          isExternal: !!isExternal,
          isInternal: !!isInternal,
          redirectPath: safeRedirectPath,
          analysisFeature: analysisFeature
        }
      });
    }

    clearAuthCookies(res);
    res.status(200).json(
      {
        status: true,
        message: 'Login successful',
        data: {
          authMethod: 'localStorage',
          token: newToken,
          token_id,
          refreshToken: refreshSession.rawToken,
          accountDetails: accountDetails[0],
          userDetails: newSafeUserValue,
          platformControl: effectivePermissions.platformControl,
          roleMenu: effectivePermissions.roleMenu,
          accountPermissionVersion: Number(accountDetails[0].account_permission_version || 1),
          isExternal: !!isExternal,
          isInternal: !!isInternal,
          redirectPath: safeRedirectPath
        }
      });
  } catch (error) {
    next(error);
  }
};

export const userResetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const mailerService = new MailerService();
  try {
    const { token, password } = req.body;
    if (!token) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userToken = await TokenModel.findOne({
      _id: token,
      ...getAccessTokenTypeFilter()
    });
    if (!userToken) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const user = await UserModel.findOne({ _id: userToken.userId });
    if (!user) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const hashNewPassword = await passwordService.hashPassword(password);
    await UserModel.updateOne({ _id: user._id, account_id: user.account_id }, { $set: { password: hashNewPassword } });
    await mailerService.sendPasswordChangeConfirmation(user);
    await VerificationCodeModel.deleteOne({ email: user.email, code: token.toString() });
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
    const effectivePermissions = accountAccessService.getEffectivePermissions(userRoleData, accountDetails[0]);
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
