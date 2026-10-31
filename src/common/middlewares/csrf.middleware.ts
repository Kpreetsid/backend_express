import { NextFunction, Request, Response } from 'express';
import { cookieAuth, refreshToken } from '@core/config/env.config';
import { LEGACY_ACCESS_COOKIE_NAME, verifyCsrfToken } from '@core/auth/auth-cookie.service';
import { cookieService } from '@common/utils/cookie.helper';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXCLUDED_PATHS = [
  '/api/users/login',
  '/api/users/authenticate',
  '/api/users/external_auth',
  '/api/users/updatePassword',
  '/api/registration',
  '/api/reset-password'
];

/**
 * Exempt only exact known routes, not arbitrary URLs whose query parameters
 * or suffixes contain a public endpoint name.
 */
export const isCsrfExemptRequestPath = (rawPath: string): boolean => {
  const path = String(rawPath || '').split('?')[0].replace(new RegExp('/+$'), '').toLowerCase();
  const prefix = path.indexOf('/api/');
  const scoped = prefix >= 0 ? path.slice(prefix).replace(new RegExp('^/api/v[0-9]+/'), '/api/') : path;
  return EXCLUDED_PATHS.some((excluded) => scoped === excluded.toLowerCase());
};
const isExcludedPath = (req: Request): boolean =>
  isCsrfExemptRequestPath(req.originalUrl || req.path || '');

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
