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

interface CachedAuthSession {
  user: any;
  companyID: string;
  role: any;
  userToken: string;
  expiresAt: number;
}

const authSessionCache = new Map<string, CachedAuthSession>();
const AUTH_CACHE_TTL_MS = 60 * 1000; // 60s TTL for high-frequency dashboard requests

export const clearAuthSessionCache = (tokenKey?: string) => {
  if (tokenKey) {
    authSessionCache.delete(tokenKey);
  } else {
    authSessionCache.clear();
  }
};

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const headerToken = req.headers.authorization?.split(' ')[1];
    const headerAccountID = req.headers.accountid as string;
    if (!headerToken || !headerAccountID) {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }

    const cacheKey = `${headerToken}:${headerAccountID}`;
    const now = Date.now();
    const cached = authSessionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      merge(req, { user: cached.user, companyID: cached.companyID, role: cached.role, userToken: cached.userToken });
      return next();
    }

    const isTokenExist: any = await TokenModel.findOne({ _id: headerToken });
    if (!isTokenExist) {
      authSessionCache.delete(cacheKey);
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    const decoded = verifyAccessToken(headerToken);
    const { id, username, companyID } = decoded;

    if (!id || !username || !companyID || headerAccountID !== companyID) {
      authSessionCache.delete(cacheKey);
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    const companyData = await companyService.verifyCompany(headerAccountID);
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

    const userObj = userData.toObject();
    const roleData = userRole.toObject().data;

    // Prune stale cache entries if growing
    if (authSessionCache.size > 5000) {
      for (const [key, value] of authSessionCache.entries()) {
        if (value.expiresAt <= now) authSessionCache.delete(key);
      }
    }
    authSessionCache.set(cacheKey, {
      user: userObj,
      companyID,
      role: roleData,
      userToken: headerToken,
      expiresAt: now + AUTH_CACHE_TTL_MS
    });

    merge(req, { user: userObj, companyID, role: roleData, userToken: headerToken });
    next();
  } catch (error) {
    next(error)
  }
};

export const isLogOutAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const headerToken = req.headers.authorization?.split(' ')[1];
    const headerAccountID = req.headers.accountid;
    if (!headerToken || !headerAccountID) {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    clearAuthSessionCache(`${headerToken}:${headerAccountID}`);
    const decoded = verifyAccessToken(headerToken);
    const { id, username, companyID } = decoded;
    const accountID = req.headers.accountid as string;
    if (!id || !username || !companyID || headerAccountID !== accountID) {
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
    audience: auth.audience
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