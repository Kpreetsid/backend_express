import crypto from 'crypto';
import { CookieOptions, Request, Response } from 'express';
import { auth, cookieAuth, refreshToken } from '../../configDB';
import { parseTtlSeconds } from '../../utils/ttl';
import { cookieService } from '../../utils/cookie';

export const LEGACY_ACCESS_COOKIE_NAME = 'access_token';
export const LEGACY_ACCOUNT_COOKIE_NAME = 'account_id';
export const LEGACY_STATE_COOKIE_NAME = 'auth_state';

interface AccessCookieInput {
  token: string;
  tokenId: string;
  userId: string;
  accountId: string;
  ttlSeconds: number;
}

interface MinimalAuthState {
  tokenId: string;
  userId: string;
  accountId: string;
  exp: number;
}

const stateKey = (): Buffer => crypto
  .createHash('sha256')
  .update(auth.external_secret || auth.secret)
  .digest();

const csrfSecret = (): string => auth.external_secret || auth.secret;
const csrfTtlSeconds = (accessTtlSeconds: number): number => Math.max(
  accessTtlSeconds,
  parseTtlSeconds(refreshToken.expiresIn, 7 * 24 * 60 * 60)
);

const withDomain = <T extends CookieOptions>(options: T): T => {
  if (cookieAuth.domain) {
    return { ...options, domain: cookieAuth.domain };
  }
  return options;
};

const httpOnlyCookie = (ttlSeconds: number): CookieOptions => withDomain({
  httpOnly: true,
  secure: cookieAuth.secure,
  sameSite: cookieAuth.sameSite,
  path: cookieAuth.path,
  maxAge: ttlSeconds * 1000
});

const readableCookie = (ttlSeconds: number): CookieOptions => withDomain({
  httpOnly: false,
  secure: cookieAuth.secure,
  sameSite: cookieAuth.sameSite,
  path: cookieAuth.path,
  maxAge: ttlSeconds * 1000
});

const clearHttpOnlyCookie = (): CookieOptions => withDomain({
  httpOnly: true,
  secure: cookieAuth.secure,
  sameSite: cookieAuth.sameSite,
  path: cookieAuth.path
});

const clearReadableCookie = (): CookieOptions => withDomain({
  httpOnly: false,
  secure: cookieAuth.secure,
  sameSite: cookieAuth.sameSite,
  path: cookieAuth.path
});

const encryptMinimalState = (input: AccessCookieInput): string => {
  const iv = crypto.randomBytes(12);
  const payload: MinimalAuthState = {
    tokenId: input.tokenId,
    userId: input.userId,
    accountId: input.accountId,
    exp: Math.floor(Date.now() / 1000) + input.ttlSeconds
  };
  const cipher = crypto.createCipheriv('aes-256-gcm', stateKey(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    iv: iv.toString('base64url'),
    ct: ct.toString('base64url'),
    tag: tag.toString('base64url')
  })).toString('base64url');
};

const sign = (value: string): string => crypto
  .createHmac('sha256', csrfSecret())
  .update(value)
  .digest('base64url');

const createCsrfToken = (tokenId: string, ttlSeconds: number): string => {
  const payload = Buffer.from(JSON.stringify({
    sid: tokenId,
    nonce: crypto.randomBytes(16).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const getAccessTokenFromCookies = (req: Request): string => {
  return cookieService.get(req, [cookieAuth.accessCookieName, LEGACY_ACCESS_COOKIE_NAME]);
};

export const getAccountIdFromCookies = (req: Request): string => {
  return cookieService.get(req, [cookieAuth.accountCookieName, LEGACY_ACCOUNT_COOKIE_NAME]);
};

export const setAccessCookies = (res: Response, input: AccessCookieInput): void => {
  const options = httpOnlyCookie(input.ttlSeconds);
  cookieService.set(res, cookieAuth.accessCookieName, input.token, options);
  cookieService.set(res, cookieAuth.accountCookieName, input.accountId, options);
  cookieService.set(res, cookieAuth.stateCookieName, encryptMinimalState(input), options);
  setCsrfCookie(res, input.tokenId, csrfTtlSeconds(input.ttlSeconds));
};

export const setCsrfCookie = (res: Response, tokenId: string, ttlSeconds: number): void => {
  cookieService.set(res, cookieAuth.csrfCookieName, createCsrfToken(tokenId, ttlSeconds), readableCookie(ttlSeconds));
};

export const clearAuthCookies = (res: Response): void => {
  cookieService.clearMany(res, [cookieAuth.accessCookieName, cookieAuth.accountCookieName, cookieAuth.stateCookieName], clearHttpOnlyCookie());
  cookieService.clearMany(res, [LEGACY_ACCESS_COOKIE_NAME, LEGACY_ACCOUNT_COOKIE_NAME, LEGACY_STATE_COOKIE_NAME], clearHttpOnlyCookie());
  cookieService.clear(res, cookieAuth.csrfCookieName, clearReadableCookie());
};

export const verifyCsrfToken = (token: string): boolean => {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof decoded.exp === 'number' && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};
