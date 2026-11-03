import assert from 'node:assert/strict';
import test from 'node:test';
import { Response } from 'express';
import { clearAuthCookies, setAccessCookies } from './auth-cookie.service';

test('CMMS auth cookies are host-only and clear using the same path', () => {
  const calls: Array<{ kind: string; name: string; options: Record<string, any> }> = [];
  const response = {
    cookie(name: string, _value: string, options: Record<string, any>) {
      calls.push({ kind: 'set', name, options });
      return this;
    },
    clearCookie(name: string, options: Record<string, any>) {
      calls.push({ kind: 'clear', name, options });
      return this;
    }
  } as unknown as Response;

  setAccessCookies(response, {
    token: 'signed-access',
    tokenId: 'token-id',
    userId: 'user-id',
    accountId: 'account-id',
    ttlSeconds: 300
  });
  clearAuthCookies(response);

  const cookies = calls.filter(call => call.kind === 'set');
  assert.ok(cookies.length >= 4);
  assert.ok(cookies.some(call => call.name.includes('cmms')));
  for (const call of calls) {
    assert.equal(Object.hasOwn(call.options, 'domain'), false, call.name);
    assert.equal(call.options.path, '/', call.name);
  }
});
