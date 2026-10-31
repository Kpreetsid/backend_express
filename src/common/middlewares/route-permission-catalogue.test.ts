import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PlatformControlManager } from '@common/constants/roles.constant';

const ROUTE_ROOTS = [
  path.join(process.cwd(), 'src', 'modules'),
  path.join(process.cwd(), 'src', 'routes')
];

const listRouteFiles = (root: string): string[] => {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(fullPath));
    } else if (/\.routes?\.ts$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

const collectRoutedPermissions = (): Array<{ module: string; action: string; file: string }> => {
  const found = new Map<string, { module: string; action: string; file: string }>();
  for (const file of ROUTE_ROOTS.flatMap(listRouteFiles)) {
    const source = fs.readFileSync(file, 'utf8');

    for (const match of source.matchAll(/hasRolePermission\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g)) {
      const item = { module: match[1], action: match[2], file: path.relative(process.cwd(), file) };
      found.set(`${item.module}:${item.action}`, item);
    }

    for (const call of source.matchAll(/hasAnyRolePermission\(\s*\[([\s\S]*?)\]\s*\)/g)) {
      for (const pair of call[1].matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g)) {
        const item = { module: pair[1], action: pair[2], file: path.relative(process.cwd(), file) };
        found.set(`${item.module}:${item.action}`, item);
      }
    }
  }
  return [...found.values()].sort((a, b) =>
    `${a.module}:${a.action}`.localeCompare(`${b.module}:${b.action}`)
  );
};

test('admin enables every permission referenced by a private route', async () => {
  const admin: any = await PlatformControlManager.getRoleMenuData('admin');
  const routed = collectRoutedPermissions();
  assert.ok(routed.length > 0, 'permission catalogue scan must discover private route permissions');

  for (const permission of routed) {
    assert.equal(
      admin?.[permission.module]?.[permission.action],
      true,
      `admin must enable ${permission.module}.${permission.action} used by ${permission.file}`
    );
  }
});

test('every lower role exposes every routed permission key for explicit delegation', async () => {
  const routed = collectRoutedPermissions();
  for (const roleName of ['manager', 'employee', 'customer', 'user']) {
    const role: any = await PlatformControlManager.getRoleMenuData(roleName);
    for (const permission of routed) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(role?.[permission.module] || {}, permission.action),
        `${roleName} must expose ${permission.module}.${permission.action} used by ${permission.file}`
      );
      assert.equal(
        typeof role[permission.module][permission.action],
        'boolean',
        `${roleName} ${permission.module}.${permission.action} must be boolean`
      );
    }
  }
});
