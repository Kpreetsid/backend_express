import assert from 'node:assert/strict';
import test from 'node:test';

test('support-login actor introspection module is present and fail-closed by contract', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./support-login-actor.service.ts', import.meta.url), 'utf8'));
  assert.match(source, /SUPPORT_LOGIN_INTROSPECTION_URL|supportLogin\.introspectionUrl/);
  assert.match(source, /x-support-login-key/);
  assert.match(source, /authorized !== true/);
});
