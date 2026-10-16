import { NextFunction, Request, Response } from 'express';
import { cookieAuth, refreshToken } from '../configDB';
import { LEGACY_ACCESS_COOKIE_NAME, verifyCsrfToken } from '../user/authentication/authCookie.service';
import { cookieService } from '../utils/cookie';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXCLUDED_PATHS = [
  '/api/users/login',
  '/api/users/authenticate',
  '/api/users/external_auth',
  '/api/users/updatePassword',
  '/api/registration',
  '/api/reset-password'
];

const isExcludedPath = (req: Request): boolean => {
  const path = (req.originalUrl || req.path || '').toLowerCase();
  return EXCLUDED_PATHS.some((excluded) => path.includes(excluded.toLowerCase()));
};

const isCookieAuthenticatedRequest = (req: Request): boolean => {
  return cookieService.has(req, [cookieAuth.accessCookieName, LEGACY_ACCESS_COOKIE_NAME, refreshToken.cookieName]);
};

export const csrfProtection = (req: Request, _res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method.toUpperCase()) || isExcludedPath(req) || !isCookieAuthenticatedRequest(req)) {
    next();
    return;
  }

  const cookieToken = cookieService.get(req, cookieAuth.csrfCookieName);
  const headerToken = String(req.get('X-CMMS-CSRF') || '');

  if (!cookieToken || cookieToken !== headerToken || !verifyCsrfToken(cookieToken)) {
    next(Object.assign(new Error('Invalid CSRF token'), { status: 403, name: 'ForbiddenError' }));
    return;
  }

  next();
};
