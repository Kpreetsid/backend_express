import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirstUser } from './firstUser.middleware';

test('requireFirstUser rejects non-first users with 403', () => {
  let status = 0;
  let jsonResponse: any = null;
  const res: any = {
    status(code: number) {
      status = code;
      return {
        json(payload: any) {
          jsonResponse = payload;
          return payload;
        }
      };
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  // Case 1: user has isFirstUser = false
  requireFirstUser({ user: { isFirstUser: false } } as any, res, next);
  assert.equal(status, 403);
  assert.equal(jsonResponse?.status, false);
  assert.equal(jsonResponse?.code, 'FIRST_USER_REQUIRED');
  assert.equal(nextCalled, false);

  // Case 2: user missing or undefined isFirstUser
  status = 0;
  jsonResponse = null;
  requireFirstUser({ user: {} } as any, res, next);
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});

test('requireFirstUser passes for user with isFirstUser = true', () => {
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  const res: any = {};

  requireFirstUser({ user: { isFirstUser: true } } as any, res, next);
  assert.equal(nextCalled, true);
});
