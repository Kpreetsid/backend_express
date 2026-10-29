import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/modules/auth/services/authentication.service.ts'), 'utf8');

test('all session responses use owner-aware effective permissions', () => {
  const matches = source.match(/getEffectivePermissionsForUser\(/g) || [];
  assert.ok(matches.length >= 3, 'login, support login and /me must use owner-aware effective permissions');
  assert.match(source, /getEffectivePermissionsForUser\(user, userRoleData, userAccount\[0\]\)/);
  assert.match(source, /getEffectivePermissionsForUser\(userDetails, userRoleMenu, accountDetails\[0\]\)/);
  assert.match(source, /getEffectivePermissionsForUser\(user, userRoleData, accountDetails\[0\]\)/);
});
