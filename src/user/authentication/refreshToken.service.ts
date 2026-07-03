import crypto from 'crypto';
import mongoose from 'mongoose';
import { CookieOptions, Request, Response } from 'express';
import { auth, refreshToken as refreshTokenConfig } from '../../configDB';
import { generateAccessToken } from '../../_config/auth';
import { IUserToken, TokenModel } from '../../models/userToken.model';
import { IUser, UserLoginPayload, UserModel } from '../../models/user.model';
import { companyService } from '../../masters/company/company.service';
import { accountFeatureService } from '../../masters/company/accountFeature.service';
import { rolesService } from '../../masters/user/role/roles.service';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { parseTtlSeconds } from '../../utils/ttl';

const REFRESH_HEADER = 'x-cmms-refresh-request';
const REFRESH_PRINCIPAL_TYPE = 'refresh_token';

interface AccessSession {
  token: string;
  token_id: mongoose.Types.ObjectId;
}

type StoredRefreshToken = IUserToken & {
  account_id: mongoose.Types.ObjectId;
  revokedAt?: Date;
  replacedByTokenHash?: string;
};

interface RefreshIssueResult {
  issued: boolean;
  rawToken?: string;
  tokenHash?: string;
  expiresAt?: Date;
}

const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: refreshTokenConfig.cookieSecure,
  sameSite: refreshTokenConfig.cookieSameSite,
  path: refreshTokenConfig.cookiePath,
  maxAge: parseTtlSeconds(refreshTokenConfig.expiresIn, 7 * 24 * 60 * 60) * 1000
});

const hashRefreshToken = (token: string): string => {
  return crypto
    .createHmac('sha256', refreshTokenConfig.secret)
    .update(token)
    .digest('hex');
};

const createRawRefreshToken = (): string => crypto.randomBytes(64).toString('base64url');

const getRequestRefreshToken = (req: Request): string => {
  const cookies = (req as any).cookies || {};
  return String(cookies[refreshTokenConfig.cookieName] || req.body?.refreshToken || '');
};

const getRequestIp = (req: Request): string => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || '';
};

const getSafeUser = (user: IUser): any => {
  const userObject = typeof (user as any).toObject === 'function' ? (user as any).toObject() : { ...(user as any) };
  delete userObject.password;
  userObject.id = userObject._id;
  return userObject;
};

const assertRefreshRequest = (req: Request): void => {
  if (req.headers[REFRESH_HEADER] !== 'true') {
    throw Object.assign(new Error('Invalid refresh request'), { status: 403 });
  }
};

class RefreshTokenService {
  readonly cookieName = refreshTokenConfig.cookieName;
  readonly refreshHeader = REFRESH_HEADER;

  async createAccessSession(user: IUser, flags: { isExternal?: boolean; isInternal?: boolean } = {}): Promise<AccessSession> {
    const tokenId = new mongoose.Types.ObjectId();
    const userTokenPayload: UserLoginPayload = {
      id: String(user._id),
      username: user.username,
      companyID: String(user.account_id),
      jti: String(tokenId)
    };
    const token = generateAccessToken(userTokenPayload);
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const userTokenData = new TokenModel({
      _id: token,
      token_id: tokenId,
      userId: user._id,
      principalType: 'user',
      isExternal: flags.isExternal || false,
      isInternal: flags.isInternal || false,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    return { token, token_id: tokenId };
  }

  async issueForUser(req: Request, res: Response, user: IUser, accessTokenId?: mongoose.Types.ObjectId): Promise<RefreshIssueResult> {
    const accountId = String(user.account_id || '');
    const cookieEnabled = await accountFeatureService.isCookieEnabledForAccount(accountId);
    if (!cookieEnabled) {
      this.clearCookie(res);
      return { issued: false };
    }

    const rawToken = createRawRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const ttlSeconds = parseTtlSeconds(refreshTokenConfig.expiresIn, 7 * 24 * 60 * 60);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await new TokenModel({
      _id: tokenHash,
      token_id: accessTokenId,
      userId: user._id,
      account_id: user.account_id,
      principalType: REFRESH_PRINCIPAL_TYPE,
      ttl: ttlSeconds,
      expiresAt,
      userAgent: String(req.headers['user-agent'] || ''),
      ipAddress: getRequestIp(req)
    }).save();

    res.cookie(refreshTokenConfig.cookieName, rawToken, getCookieOptions());
    return { issued: true, rawToken, tokenHash, expiresAt };
  }

  clearCookie(res: Response): void {
    res.clearCookie(refreshTokenConfig.cookieName, {
      httpOnly: true,
      secure: refreshTokenConfig.cookieSecure,
      sameSite: refreshTokenConfig.cookieSameSite,
      path: refreshTokenConfig.cookiePath
    });
  }

  async revokeCurrent(req: Request, res?: Response): Promise<void> {
    const rawToken = getRequestRefreshToken(req);
    if (!rawToken) {
      if (res) {
        this.clearCookie(res);
      }
      return;
    }

    await TokenModel.updateOne(
      { _id: hashRefreshToken(rawToken), principalType: REFRESH_PRINCIPAL_TYPE, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    if (res) {
      this.clearCookie(res);
    }
  }

  async refreshAccessToken(req: Request, res: Response): Promise<any> {
    assertRefreshRequest(req);
    const rawToken = getRequestRefreshToken(req);
    if (!rawToken) {
      throw Object.assign(new Error('Refresh token missing'), { status: 401, name: 'InvalidTokenError' });
    }

    const tokenHash = hashRefreshToken(rawToken);
    const storedRefreshToken = await TokenModel
      .findOne({ _id: tokenHash, principalType: REFRESH_PRINCIPAL_TYPE })
      .exec() as StoredRefreshToken | null;
    if (!storedRefreshToken || storedRefreshToken.revokedAt) {
      this.clearCookie(res);
      throw Object.assign(new Error('Refresh token invalid or revoked'), { status: 401, name: 'InvalidTokenError' });
    }

    if (storedRefreshToken.expiresAt.getTime() <= Date.now()) {
      storedRefreshToken.revokedAt = new Date();
      await storedRefreshToken.save();
      this.clearCookie(res);
      throw Object.assign(new Error('Refresh token expired'), { status: 401, name: 'TokenExpiredError' });
    }

    const accountId = String(storedRefreshToken.account_id || '');
    const cookieEnabled = await accountFeatureService.isCookieEnabledForAccount(accountId);
    if (!cookieEnabled) {
      await this.revokeStored(storedRefreshToken);
      this.clearCookie(res);
      throw Object.assign(new Error('Refresh token disabled for this account'), { status: 401, name: 'InvalidTokenError' });
    }

    const user = await UserModel
      .findOne({ _id: storedRefreshToken.userId, account_id: storedRefreshToken.account_id, user_status: 'active' })
      .select('-password');
    if (!user) {
      await this.revokeStored(storedRefreshToken);
      this.clearCookie(res);
      throw Object.assign(new Error('User not found'), { status: 401 });
    }

    if (user.user_role !== 'admin') {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        await this.revokeStored(storedRefreshToken);
        this.clearCookie(res);
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }

    const accountDetails = await companyService.getAllCompanies({ _id: user.account_id });
    if (!accountDetails || accountDetails.length === 0) {
      await this.revokeStored(storedRefreshToken);
      this.clearCookie(res);
      throw Object.assign(new Error('User account not found'), { status: 401 });
    }

    let userRoleData: any = await rolesService.verifyUserRole(String(user._id), String(user.account_id));
    if (!userRoleData) {
      userRoleData = await rolesService.createUserRole(user.user_role, user);
    }

    const accessSession = await this.createAccessSession(user);
    if (refreshTokenConfig.rotate) {
      const newRefresh = await this.issueForUser(req, res, user, accessSession.token_id);
      if (!newRefresh.issued || !newRefresh.tokenHash) {
        await this.revokeStored(storedRefreshToken);
        this.clearCookie(res);
        throw Object.assign(new Error('Refresh token disabled for this account'), { status: 401, name: 'InvalidTokenError' });
      }
      storedRefreshToken.revokedAt = new Date();
      storedRefreshToken.replacedByTokenHash = newRefresh.tokenHash;
      await storedRefreshToken.save();
    } else {
      res.cookie(refreshTokenConfig.cookieName, rawToken, getCookieOptions());
    }

    return {
      token: accessSession.token,
      token_id: accessSession.token_id,
      accountDetails: accountDetails[0],
      userDetails: getSafeUser(user),
      platformControl: userRoleData.data,
      roleMenu: userRoleData.roleMenu
    };
  }

  private async revokeStored(storedRefreshToken: StoredRefreshToken): Promise<void> {
    storedRefreshToken.revokedAt = new Date();
    await storedRefreshToken.save();
  }
}

export const refreshTokenService = new RefreshTokenService();

export const __refreshTokenTestUtils = {
  hashRefreshToken,
  getCookieOptions,
  getRequestRefreshToken,
  REFRESH_PRINCIPAL_TYPE,
  REFRESH_HEADER
};
