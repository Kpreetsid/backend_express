import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('user CRUD routes enforce backend role permissions', () => {
  const source = read('src/modules/users/routes/user.routes.ts');
  assert.match(source, /hasRolePermission('users', 'view').*getUsers|userRouter\.get\('\/', hasRolePermission\('users', 'view'\)/s);
  assert.match(source, /userRouter\.get\('\/location\/:id', hasRolePermission\('users', 'view'\)/);
  assert.match(source, /userRouter\.post\('\/', hasRolePermission\('users', 'add'\)/);
  assert.match(source, /userRouter\.put\('\/:id', hasRolePermission\('users', 'edit'\)/);
  assert.match(source, /userRouter\.patch\('\/:id', hasRolePermission\('users', 'edit'\)/);
  assert.match(source, /userRouter\.delete\('\/:id', hasRolePermission\('users', 'delete'\)/);
});

test('role-menu mutations enforce permission administration rights', () => {
  const source = read('src/modules/users/routes/roles.routes.ts');
  assert.match(source, /roleRouter\.get\('\/', hasRolePermission\('permission', 'view'\)/);
  assert.match(source, /roleRouter\.post\('\/', hasRolePermission\('permission', 'add'\)/);
  assert.match(source, /roleRouter\.put\('\/:id', hasRolePermission\('permission', 'edit'\)/);
  assert.match(source, /roleRouter\.patch\('\/:id', hasRolePermission\('permission', 'edit'\)/);
  assert.match(source, /roleRouter\.delete\('\/:id', hasRolePermission\('permission', 'delete'\)/);
});
