import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('logout must be POST only because it revokes the session', () => {
  const source = fs.readFileSync('src/modules/auth/routes/authentication.routes.ts', 'utf8');
  assert.ok(source.includes("userRouter.post('/logout'"));
  assert.equal(source.includes("userRouter.get('/logout'"), false);
});
