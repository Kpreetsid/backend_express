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
