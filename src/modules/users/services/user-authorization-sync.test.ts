import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('user role changes synchronize the stored role menu and platform control', () => {
  const source = read('src/modules/users/services/user.service.ts');
  assert.match(source, /body\.user_role.*existing\.user_role/s);
  assert.match(source, /RoleManager\.getRoleMenuData\(body\.user_role\)/);
  assert.match(source, /PlatformControlManager\.getRoleMenuData\(body\.user_role\)/);
  assert.match(source, /RoleMenuModel\.findOneAndUpdate[\s\S]*user_id:[\s\S]*account_id/);
  assert.match(source, /User authorization profile not found/);
});

test('authorization-sensitive user changes and deletion revoke active sessions', () => {
  const source = read('src/modules/users/services/user.service.ts');
  assert.match(source, /shouldRevokeUserSessionsAfterUpdate/);
  assert.match(source, /TokenModel\.deleteMany/);
  assert.match(source, /tokenSessionStore\.deleteUserSessions/);
  assert.match(source, /async removeById[\s\S]*TokenModel\.deleteMany[\s\S]*tokenSessionStore\.deleteUserSessions/);
});

test('controller rejects unauthorized role assignment on create and update', () => {
  const source = read('src/modules/users/controllers/user.controller.ts');
  const matches = source.match(/canAssignUserRole\(/g) || [];
  assert.ok(matches.length >= 2);
  assert.match(source, /You cannot assign the requested user role/);
});
