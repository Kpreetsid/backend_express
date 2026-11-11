import { NextFunction, Request, Response } from 'express';
import { cookieAuth, refreshToken } from '../configDB';
import { LEGACY_ACCESS_COOKIE_NAME, verifyCsrfToken } from '../user/authentication/authCookie.service';
import { cookieService } from '../utils/cookie';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXCLUDED_PATHS = new Set([
  '/users/login', 
  '/users/create_external_token',
  '/users/authenticate', 
  '/users/two-step/verify',
  '/users/two-step/resend', 
  '/users/external_auth', 
  '/users/email-login/inspect',
  '/users/email-login/exchange',
  '/users/updatepassword',
  '/registration', 
  '/registration/sendemail', 
  '/registration/verifyotp',
  '/reset-password/send-verification-email', 
  '/reset-password/verify-otp',
  '/reset-password/change-password'
]);

const isExcludedPath = (req: Request): boolean => {
  // Match Express's case-insensitive path and optional trailing slash, never queries.
  const path = (req.originalUrl || req.path || '').split('?')[0].toLowerCase().replace(/\/$/, '');
  const base = (process.env.API_BASE_PATH || '/cmms_express').toLowerCase();
  const mounts = ['/api/v1', '/api', base + '/api/v1', base + '/api'];
  return mounts.some(mount => path.startsWith(mount + '/') && EXCLUDED_PATHS.has(path.slice(mount.length)));
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
