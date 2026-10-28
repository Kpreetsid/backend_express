import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedSupportActorResponse } from './support-login-actor.service';

test('support actor introspection accepts only an explicit authorized response', () => {
  assert.equal(isAuthorizedSupportActorResponse({ status: true, authorized: true }), true);
  assert.equal(isAuthorizedSupportActorResponse({ status: true, authorized: false }), false);
  assert.equal(isAuthorizedSupportActorResponse({ authorized: true }), false);
  assert.equal(isAuthorizedSupportActorResponse(null), false);
});
