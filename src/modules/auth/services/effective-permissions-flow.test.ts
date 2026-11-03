import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/modules/auth/services/authentication.service.ts'), 'utf8');

test('cookie session bootstrap uses owner-aware effective permissions from /me', () => {
  const matches = source.match(/getEffectivePermissionsForUser\(/g) || [];
  assert.ok(matches.length >= 1, '/me must compute owner-aware effective permissions');
  assert.match(source, /getEffectivePermissionsForUser\(user, userRoleData, accountDetails\[0\]\)/);
  assert.match(source, /platformControl:\s*effectivePermissions\.platformControl/);
  assert.match(source, /roleMenu:\s*effectivePermissions\.roleMenu/);
  assert.match(source, /accountPermissionVersion:/);
});

test('login and support login provision role state before establishing cookie sessions', () => {
  assert.match(source, /rolesService\.verifyUserRole\(String\(user\._id\), String\(user\.account_id\)\)/);
  assert.match(source, /rolesService\.createUserRole\(user\.user_role, user\)/);
  assert.match(source, /rolesService\.verifyUserRole\(String\(userDetails\._id\), String\(userDetails\.account_id\)\)/);
  assert.match(source, /rolesService\.createUserRole\(userDetails\.user_role, userDetails\)/);
  assert.match(source, /setAccessCookies\(res,/);
});
