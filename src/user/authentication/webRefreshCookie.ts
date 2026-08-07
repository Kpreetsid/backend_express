import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { auth, environment, refreshToken as refreshTokenConfig } from '../../configDB';
import { parseTtlSeconds } from '../../utils/ttl';

const refreshCookieName = 'cmms_refresh_token';
const csrfCookieName = 'cmms_csrf';

const readCookie = (request: Request, name: string): string => {
  const cookieHeader = request.headers.cookie || '';
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return '';
};

const secureCookieOptions = {
  secure: environment.isProduction,
  sameSite: 'strict' as const,
  path: '/'
};

export const setWebRefreshCookies = (response: Response, refreshToken: string): void => {
  if (!auth.webRefreshCookieEnabled) return;

  const maxAge = parseTtlSeconds(refreshTokenConfig.expiresIn, 7 * 24 * 60 * 60) * 1000;
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  response.cookie(refreshCookieName, refreshToken, {
    ...secureCookieOptions,
    httpOnly: true,
    maxAge
  });
  response.cookie(csrfCookieName, csrfToken, {
    ...secureCookieOptions,
    httpOnly: false,
    maxAge
  });
  response.setHeader('X-CSRF-Token', csrfToken);
};

export const clearWebRefreshCookies = (response: Response): void => {
  if (!auth.webRefreshCookieEnabled) return;
  response.clearCookie(refreshCookieName, { ...secureCookieOptions, httpOnly: true });
  response.clearCookie(csrfCookieName, { ...secureCookieOptions, httpOnly: false });
};

export const getRefreshTokenForRotation = (request: Request): string => {
  const bodyToken = String(request.body?.refreshToken || '');
  if (bodyToken) return bodyToken;
  if (!auth.webRefreshCookieEnabled) return '';

  const cookieToken = readCookie(request, refreshCookieName);
  const cookieCsrf = readCookie(request, csrfCookieName);
  const headerCsrf = String(request.headers['x-csrf-token'] || '');
  const csrfMatches = cookieCsrf.length === headerCsrf.length
    && cookieCsrf.length > 0
    && crypto.timingSafeEqual(Buffer.from(cookieCsrf), Buffer.from(headerCsrf));
  if (!cookieToken || !csrfMatches) {
    throw Object.assign(new Error('Invalid CSRF token'), { status: 403 });
  }
  return cookieToken;
};

export const getRefreshTokenForLogout = (request: Request): string =>
  String(request.headers['x-cmms-refresh-token'] || '')
  || (auth.webRefreshCookieEnabled ? readCookie(request, refreshCookieName) : '');
