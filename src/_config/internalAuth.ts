import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, VerifyOptions } from 'jsonwebtoken';
import { auth } from '../configDB';

interface InternalAdminPayload extends JwtPayload {
  userId: string;
  username: string;
  role: string;
}

const internalSecret = process.env.INTERNAL_AUTH_SECRET || auth.secret;
const internalIssuer = process.env.INTERNAL_AUTH_ISSUER;
const internalAudience = process.env.INTERNAL_AUTH_AUDIENCE;

export const verifyInternalAdminAccessToken = (token: string): InternalAdminPayload => {
  if (!token || !internalSecret) {
    throw Object.assign(new Error('Internal authentication is not configured'), { status: 401 });
  }

  const options: VerifyOptions = {
    algorithms: [(process.env.INTERNAL_AUTH_ALGORITHM || auth.algorithm) as jwt.Algorithm]
  };
  if (internalIssuer) options.issuer = internalIssuer;
  if (internalAudience) options.audience = internalAudience;

  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, internalSecret, options);
  } catch {
    throw Object.assign(new Error('Invalid or expired internal access token'), { status: 401 });
  }
  if (typeof payload === 'string'
    || !payload.userId
    || !payload.username
    || typeof payload.exp !== 'number') {
    throw Object.assign(new Error('Invalid internal access token'), { status: 401 });
  }
  if (String(payload.role || '').trim().toLowerCase() !== 'admin') {
    throw Object.assign(new Error('Internal administrator access is required'), { status: 403 });
  }

  return payload as InternalAdminPayload;
};

export const isInternalAdminAuthenticated = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authorization = String(req.headers.authorization || '');
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw Object.assign(new Error('Internal administrator authentication is required'), { status: 401 });
    }
    const internalUser = verifyInternalAdminAccessToken(token);
    Object.assign(req, { internalUser });
    next();
  } catch (error) {
    next(error);
  }
};
