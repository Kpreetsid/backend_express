import test from 'node:test';
import assert from 'node:assert/strict';
import { accountAccessService } from './account-access.service';

const full = (parent?: string) => ({ level: parent ? 1 : 0, ...(parent ? { parent } : {}), view: true, add: true, edit: true, delete: true, import: true, export: true });
const disabled = (parent?: string) => ({ level: parent ? 1 : 0, ...(parent ? { parent } : {}), view: false, add: false, edit: false, delete: false, import: false, export: false });

test('newly protected CMMS modules obey account feature caps', () => {
  const accountMenu: any = {
    master_library: full(),
    work_order_templates: disabled('master_library'),
    procedures: disabled('master_library'),
    master_inspections: full(),
    inspections: disabled('master_inspections'),
    master_work_request: full(),
    work_request_status: disabled('master_work_request')
  };

  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'work_order_templates', 'view'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'procedures', 'edit'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'inspections', 'add'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'work_request_status', 'edit'), false);
});

test('enabled account features allow the matching platform actions', () => {
  const accountMenu: any = {
    master_library: full(),
    work_order_templates: full('master_library'),
    procedures: full('master_library'),
    master_inspections: full(),
    inspections: full('master_inspections'),
    master_work_request: full(),
    work_request_status: full('master_work_request')
  };

  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'work_order_templates', 'view'), true);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'procedures', 'edit'), true);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'inspections', 'add'), true);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'work_request_status', 'edit'), true);
});


test('first account user receives full role defaults before account caps are applied', async () => {
  const account: any = {
    experience_profile: 'standard_account',
    account_role_menu: {
      master_asset: full(),
      asset: full('master_asset'),
      master_admin_panel: disabled(),
      users: disabled('master_admin_panel')
    }
  };

  const effective = await accountAccessService.getEffectivePermissionsForUser(
    { isFirstUser: true },
    {
      data: { asset: { delete_asset: false }, users: { add: false } },
      roleMenu: { asset: { level: 1, parent: 'master_asset', view: false, delete: false } }
    },
    account
  );

  assert.equal(effective.platformControl.asset.delete_asset, true);
  assert.equal(effective.platformControl.users.add, false);
  assert.equal(effective.roleMenu.users.view, false);
});


test('parent account features fail closed across all child platform actions', () => {
  const accountMenu: any = {
    master_asset: disabled(),
    master_location: disabled(),
    master_work_order: disabled(),
    master_library: disabled(),
    master_inventory: disabled(),
    master_admin_panel: disabled()
  };

  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'asset', 'add_asset'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'location', 'edit_location'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'workOrder', 'edit_work_order'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'procedures', 'edit'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'inventory', 'delete'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'users', 'edit'), false);
});

test('custom observation and work-order comment actions obey their child account permissions', () => {
  const accountMenu: any = {
    master_asset: full(),
    observation: disabled('master_asset'),
    master_work_order: full(),
    comment_work_order: disabled('master_work_order')
  };
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'asset', 'edit_observation'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'asset', 'delete_observation'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'workOrder', 'edit_comment_work_order'), false);
  assert.equal(accountAccessService.isPlatformActionAllowed(accountMenu, 'workOrder', 'delete_comment_work_order'), false);
});


test('legacy role documents inherit newly introduced defaults without overriding explicit choices', async () => {
  const account: any = { experience_profile: 'standard_account', account_role_menu: {} };

  const admin = await accountAccessService.getEffectivePermissionsForUser(
    { user_role: 'admin', isFirstUser: false },
    { data: { inventory: { delete: false } }, roleMenu: {} },
    account
  );
  assert.equal(admin.platformControl.inspections.view, true);
  assert.equal(admin.platformControl.work_order_templates.add, true);
  assert.equal(admin.platformControl.inventory.delete, false);

  const manager = await accountAccessService.getEffectivePermissionsForUser(
    { user_role: 'manager', isFirstUser: false },
    { data: {}, roleMenu: {} },
    account
  );
  assert.equal(manager.platformControl.inspections.view, true);
  assert.equal(manager.platformControl.inspections.add, false);
});


test('permission delegation cannot exceed the actor effective platform control', () => {
  const actor: any = {
    inventory: { view: true, add: false, edit: true, delete: false },
    users: { view: true, edit: false }
  };

  assert.equal(accountAccessService.canDelegatePlatformControl(actor, { inventory: { edit: true } }), true);
  assert.equal(accountAccessService.canDelegatePlatformControl(actor, { inventory: { add: true } }), false);
  assert.equal(accountAccessService.canDelegatePlatformControl(actor, { inventory: { delete: false } }), true);
  assert.equal(accountAccessService.canDelegatePlatformControl(actor, { users: { edit: true } }), false);
  assert.equal(accountAccessService.canDelegatePlatformControl(actor, { unknown: { view: true } }), false);
});
