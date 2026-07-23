import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { auth } from '../configDB';
import * as crypto from "crypto";
import { merge } from 'lodash';
import { usersService } from '../masters/user/user.service';
import { IUserRoleMenu } from "../models/userRoleMenu.model";
import { IUser, UserLoginPayload } from '../models/user.model';
import { rolesService } from '../masters/user/role/roles.service';
import { companyService } from '../masters/company/company.service';
import { TokenModel } from '../models/userToken.model';
import { TokenBlacklist } from '../_cache/auth/tokenBlacklist';
import { tokenSessionStore, TokenSessionRecord } from '../_cache/session/tokenSessionStore';
import { getAccessTokenFromCookies, getAccountIdFromCookies } from '../user/authentication/authCookie.service';
import { accountAccessService } from '../_role/accountAccess.service';

const invalidTokenError = (): Error => Object.assign(new Error('Invalid token'), { status: 401 });

const remainingTtlSeconds = (expiresAt: unknown): number => {
  const expiresAtMs = new Date(expiresAt as any).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
};

const getAccessSession = async (token: string, decoded: JwtPayload): Promise<TokenSessionRecord | null> => {
  const cachedSession = await tokenSessionStore.getAccessSession(token);
  if (cachedSession) {
    return cachedSession;
  }

  const tokenDocument: any = await TokenModel
    .findOne({ _id: token, principalType: 'user' })
    .lean();
  if (!tokenDocument) {
    return null;
  }

  const ttlSeconds = remainingTtlSeconds(tokenDocument.expiresAt);
  if (ttlSeconds <= 0) {
    return null;
  }

  const record: TokenSessionRecord = {
    tokenId: String(tokenDocument.token_id || decoded.jti || ''),
    userId: String(tokenDocument.userId || decoded.id || ''),
    accountId: String(tokenDocument.account_id || decoded.companyID || ''),
    principalType: 'user',
    expiresAt: new Date(tokenDocument.expiresAt).toISOString(),
    isExternal: !!tokenDocument.isExternal,
    isInternal: !!tokenDocument.isInternal
  };

  await tokenSessionStore.setAccessSession({
    ...record,
    token,
    ttlSeconds
  });
  return record;
};

interface AuthenticatedTokenContext {
  token: string;
  accountId: string;
  companyID: string;
  decoded: JwtPayload;
  userData: IUser;
  roleData: IUserRoleMenu;
  role: any;
  roleMenu: any;
  accountPermissionVersion: number;
  isExternal: boolean;
  isInternal: boolean;
}

export const authenticateTokenContext = async (token: string, accountId: string): Promise<AuthenticatedTokenContext> => {
  if (!token || !accountId) {
    throw Object.assign(new Error('Unauthorized access'), { status: 401 });
  }

  const decoded = verifyAccessToken(token);
  const { id, username, companyID } = decoded;
  const normalizedAccountId = String(accountId);

  if (!id || !username || !companyID || normalizedAccountId !== String(companyID)) {
    throw invalidTokenError();
  }
  if (await TokenBlacklist.isBlacklisted(token)) {
    throw invalidTokenError();
  }

  const accessSession = await getAccessSession(token, decoded);
  if (!accessSession) {
    throw invalidTokenError();
  }
  if (accessSession.userId !== String(id) || (accessSession.accountId && accessSession.accountId !== String(companyID))) {
    throw invalidTokenError();
  }

  const companyData = await companyService.verifyCompany(normalizedAccountId);
  if (!companyData) {
    throw Object.assign(new Error('Account ID is invalid'), { status: 401 });
  }

  const userData: IUser | null = await usersService.verifyUserLogin({ id, companyID, username });
  if (!userData) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const userRole: IUserRoleMenu | null = await rolesService.verifyUserRole(id, companyID);
  if (!userRole) {
    throw Object.assign(new Error('User role not found'), { status: 401 });
  }
  if (userRole.account_id.toString() !== companyID) {
    throw Object.assign(new Error('User does not belong to the company'), { status: 403 });
  }

  const effectivePermissions = accountAccessService.getEffectivePermissions(userRole, companyData);

  return {
    token,
    accountId: normalizedAccountId,
    companyID: String(companyID),
    decoded,
    userData,
    roleData: userRole,
    role: effectivePermissions.platformControl,
    roleMenu: effectivePermissions.roleMenu,
    accountPermissionVersion: Number(companyData.account_permission_version || 1),
    isExternal: !!accessSession.isExternal,
    isInternal: !!accessSession.isInternal
  };
};

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    let headerToken = req.headers.authorization?.split(' ')[1];
    let headerAccountID = req.headers.accountid as string;

    if (!headerToken) {
      headerToken = getAccessTokenFromCookies(req);
    }
    if (!headerAccountID) {
      headerAccountID = getAccountIdFromCookies(req);
    }

    const context = await authenticateTokenContext(headerToken || '', String(headerAccountID || ''));
    merge(req, {
      user: context.userData.toObject(),
      companyID: context.companyID,
      role: context.role,
      roleMenu: context.roleMenu,
      accountPermissionVersion: context.accountPermissionVersion,
      userToken: context.token,
      authFlags: {
        isExternal: context.isExternal,
        isInternal: context.isInternal
      }
    });
    next();
  } catch (error) {
    next(error)
  }
};

export const isLogOutAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    let headerToken = req.headers.authorization?.split(' ')[1];
    let headerAccountID = req.headers.accountid as string;

    if (!headerToken) {
      headerToken = getAccessTokenFromCookies(req);
    }
    if (!headerAccountID) {
      headerAccountID = getAccountIdFromCookies(req);
    }

    if (!headerToken || !headerAccountID) {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const decoded = verifyAccessToken(headerToken);
    const { id, username, companyID } = decoded;
    if (!id || !username || !companyID || String(headerAccountID) !== String(companyID)) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    merge(req, { user_id: id, userToken: headerToken });
    next();
  } catch (error) {
    next(error)
  }
};

export const decodedAccessToken = (token: string): JwtPayload => {
  return jwt.decode(token) as JwtPayload;
};

export const generateAccessToken = (payload: UserLoginPayload): string => {
  return jwt.sign(payload, auth.secret, {
    expiresIn: auth.expiresIn,
    algorithm: auth.algorithm as jwt.Algorithm,
    issuer: auth.issuer,
    audience: auth.audience,
    // Two sessions can be issued for the same user within one second during
    // refresh. A unique JWT ID prevents identical tokens from colliding with
    // the token collection's `_id` index.
    jwtid: crypto.randomUUID()
  } as jwt.SignOptions);
};

export const generateExternalAccessToken = (body: any, ttlSeconds: number = 300): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const now = Math.floor(Date.now() / 1000);
  body.iat = Math.floor(Date.now() / 1000);
  body.exp = now + ttlSeconds;
  const plaintext = Buffer.from(JSON.stringify(body), "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const tokenStruct = {
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64")
  };
  return Buffer.from(JSON.stringify(tokenStruct)).toString("base64");
};

const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, auth.secret, {
    algorithms: [auth.algorithm as jwt.Algorithm],
    issuer: auth.issuer,
    audience: auth.audience
  }) as JwtPayload;
};

export const verifyExternalAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, auth.external_secret, {
    algorithms: [auth.algorithm as jwt.Algorithm],
    issuer: auth.issuer,
    audience: auth.audience
  }) as JwtPayload;
};

const getKey = (): Buffer => {
  return crypto.createHash("sha256").update(auth.external_secret).digest();
}

export const encryptToken = (email: string, ttlSeconds: number = 300): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const now = Math.floor(Date.now() / 1000);
  const payload = { email, iat: now, exp: now + ttlSeconds };
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const tokenStruct = {
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64")
  };
  return Buffer.from(JSON.stringify(tokenStruct)).toString("base64");
}

export const decryptToken = (token: string): any => {
  try {
    const key = getKey();
    const decodedJson = Buffer.from(token, "base64").toString("utf8");
    const decoded = JSON.parse(decodedJson);
    const iv = Buffer.from(decoded.iv, "base64");
    const ct = Buffer.from(decoded.ct, "base64");
    const tag = Buffer.from(decoded.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch (error: any) {
    throw Object.assign(new Error('Invalid or corrupted external token'), { status: 401, name: 'InvalidTokenError' });
  }
}

export const verifyEncryptedToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { external_token } = req.body;
    if (!external_token || typeof external_token !== "string") {
      throw Object.assign(new Error('Token missing in body'), { status: 401 });
    }
    const payload = decryptToken(external_token);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw Object.assign(new Error('Token expired'), { status: 401 });
    }
    next();
  } catch (error: any) {
    next(error);
  }
}
