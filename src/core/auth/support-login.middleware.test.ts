import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidSupportServiceKey } from './support-login.middleware';

test('support service key requires a configured exact secret', () => {
  assert.equal(isValidSupportServiceKey('correct-secret', 'correct-secret'), true);
  assert.equal(isValidSupportServiceKey('wrong-secret', 'correct-secret'), false);
  assert.equal(isValidSupportServiceKey('', 'correct-secret'), false);
  assert.equal(isValidSupportServiceKey('correct-secret', ''), false);
});
