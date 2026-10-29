import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('logout must be POST only because it revokes the session', () => {
 const source = fs.readFileSync('src/modules/auth/routes/authentication.routes.ts', 'utf8');
 assert.match(source, /userRouter\\.post\\('\\/logout'/);
 assert.doesNotMatch(source, /userRouter\\.get\\('\\/logout'/);
});
