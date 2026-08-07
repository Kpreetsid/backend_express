import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auth } from '../../configDB';
import {
  clearWebRefreshCookies,
  getRefreshTokenForLogout,
  getRefreshTokenForRotation,
  setWebRefreshCookies
} from './webRefreshCookie';

const originalCookieFlag = auth.webRefreshCookieEnabled;

afterEach(() => {
  auth.webRefreshCookieEnabled = originalCookieFlag;
});

describe('web refresh-cookie transport', () => {
  it('sets an HttpOnly refresh cookie and readable CSRF companion behind the flag', () => {
    auth.webRefreshCookieEnabled = true;
    const response = {
      cookie: vi.fn(),
      setHeader: vi.fn()
    } as unknown as Response;

    setWebRefreshCookies(response, 'refresh-value');

    expect(response.cookie).toHaveBeenCalledWith(
      'cmms_refresh_token',
      'refresh-value',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'cmms_csrf',
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'strict' })
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
  });

  it('clears both cookie credentials and reads logout transports compatibly', () => {
    auth.webRefreshCookieEnabled = true;
    const response = { clearCookie: vi.fn() } as unknown as Response;
    clearWebRefreshCookies(response);
    expect(response.clearCookie).toHaveBeenCalledTimes(2);

    expect(getRefreshTokenForLogout({
      headers: { 'x-cmms-refresh-token': 'header-refresh' }
    } as unknown as Request)).toBe('header-refresh');
    expect(getRefreshTokenForLogout({
      headers: { cookie: 'cmms_refresh_token=cookie-refresh' }
    } as unknown as Request)).toBe('cookie-refresh');
  });

  it('does not mutate responses while the web-cookie feature is disabled', () => {
    auth.webRefreshCookieEnabled = false;
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      setHeader: vi.fn()
    } as unknown as Response;
    setWebRefreshCookies(response, 'refresh-value');
    clearWebRefreshCookies(response);
    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('accepts legacy body transport without requiring cookie CSRF', () => {
    auth.webRefreshCookieEnabled = true;
    const request = {
      body: { refreshToken: 'legacy-refresh-value' },
      headers: {}
    } as Request;

    expect(getRefreshTokenForRotation(request)).toBe('legacy-refresh-value');
  });

  it('requires matching double-submit CSRF for cookie rotation', () => {
    auth.webRefreshCookieEnabled = true;
    const request = {
      body: {},
      headers: {
        cookie: 'cmms_refresh_token=cookie-refresh; cmms_csrf=csrf-value',
        'x-csrf-token': 'csrf-value'
      }
    } as unknown as Request;
    expect(getRefreshTokenForRotation(request)).toBe('cookie-refresh');

    request.headers['x-csrf-token'] = 'wrong-value';
    expect(() => getRefreshTokenForRotation(request)).toThrow('Invalid CSRF token');
  });
});
