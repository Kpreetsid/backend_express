import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRolePermission } from './permission.middleware';
import { PlatformControlManager } from '../constants/roles.constant';

const run = async (middleware: any, req: any): Promise<any> =>
  await new Promise(resolve => middleware(req, {}, (error: any) => resolve(error || null)));

test('role middleware consumes effective permissions and never bypasses account-capped authorization', async () => {
  const deniedWithoutEffectivePermission = await run(
    hasRolePermission('asset', 'delete_asset'),
    { user: { user_role: 'employee', isFirstUser: true }, role: {} }
  );
  assert.equal(deniedWithoutEffectivePermission?.status, 403);

  const allowedWithEffectivePermission = await run(
    hasRolePermission('asset', 'delete_asset'),
    { user: { user_role: 'employee', isFirstUser: true }, role: { asset: { delete_asset: true } } }
  );
  assert.equal(allowedWithEffectivePermission, null);

  const missingUserError = await run(
    hasRolePermission('asset', 'delete_asset'),
    { user: {}, role: { asset: { delete_asset: true } } }
  );
  assert.equal(missingUserError?.status, 403);
});

test('ordinary users still require the requested module action', async () => {
  const denied = await run(
    hasRolePermission('inventory', 'delete'),
    { user: { user_role: 'manager', isFirstUser: false }, role: { inventory: { delete: false } } }
  );
  assert.equal(denied?.status, 403);

  const allowed = await run(
    hasRolePermission('inventory', 'delete'),
    { user: { user_role: 'manager', isFirstUser: false }, role: { inventory: { delete: true } } }
  );
  assert.equal(allowed, null);
});

test('admin platform control covers every currently routed CMMS module action', async () => {
  const admin: any = await PlatformControlManager.getRoleMenuData('admin');

  const required: Record<string, string[]> = {
    asset: ['view', 'add_asset', 'delete_asset', 'add_child_asset', 'edit_asset', 'create_report', 'delete_report', 'download_report', 'edit_report', 'config_alarm', 'add_observation', 'edit_observation', 'delete_observation', 'create_endpoint', 'edit_endpoint', 'delete_end_point', 'attach_sensor', 'update_config'],
    location: ['view', 'add_location', 'delete_location', 'add_child_location', 'edit_location', 'create_report', 'delete_report', 'download_report', 'edit_report'],
    workOrder: ['view', 'create_work_order', 'edit_work_order', 'delete_work_order', 'update_work_order_status', 'add_comment_work_order', 'edit_comment_work_order', 'delete_comment_work_order', 'add_task_work_order', 'update_parts_work_order'],
    floorMap: ['create_kpi', 'view_floor_map', 'delete_kpi', 'upload_floor_map'],
    preventive: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    inspections: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    form: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    form_category: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    work_order_templates: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    procedures: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    work_request: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    work_request_status: ['view', 'edit'],
    posts: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    inventory: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    gateways: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    peripheral_sensors: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    admin_panel: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    users: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    permission: ['view', 'add', 'edit', 'delete', 'import', 'export'],
    asset_mail: ['view', 'add', 'edit', 'delete', 'import', 'export']
  };

  for (const [moduleName, actions] of Object.entries(required)) {
    assert.ok(admin[moduleName], `missing admin module ${moduleName}`);
    for (const action of actions) {
      assert.equal(admin[moduleName][action], true, `admin must allow ${moduleName}.${action}`);
    }
  }
});
