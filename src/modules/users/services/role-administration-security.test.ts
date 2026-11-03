import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('role administration protects first user permissions', () => {
  const source = read('src/modules/users/controllers/roles.controller.ts');
  assert.match(source, /First user permissions cannot be modified/);
  assert.match(source, /First user permissions cannot be removed/);
  assert.match(source, /You cannot modify an administrator permission profile/);
  assert.match(source, /canDelegatePlatformControl/);
});

test('permission changes revoke affected user sessions', () => {
  const source = read('src/modules/users/controllers/roles.controller.ts');
  const calls = source.match(/revokeAuthorizationSessions\(/g) || [];
  assert.ok(calls.length >= 2, 'role update and removal must revoke sessions');
});

test('configurable roles merge current role defaults before rendering or mutation', () => {
  const source = read('src/modules/users/controllers/roles.controller.ts');
  assert.match(source, /getRoleDataWithDefaultsForUser/);
  assert.match(source, /toConfigurableRoleForUser/);
});
