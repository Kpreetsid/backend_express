import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const accountA = '64a000000000000000000001';
const accountB = '64b000000000000000000002';
const userId = '64a000000000000000000003';
const sopId = '64a000000000000000000004';
const foreignSopId = '64b000000000000000000005';
const locationId = '64a000000000000000000006';
const categoryId = '64a000000000000000000007';

function loadModule(relativePath: string, overrides: Record<string, any>) {
  const filename = path.resolve(__dirname, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} as any };
  const localRequire = (id: string) => Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id]
    : id.startsWith('.') ? require(path.resolve(path.dirname(filename), id)) : require(id);
  vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, __dirname: path.dirname(filename), console });
  return module.exports;
}

function routes() {
  const calls: any[] = [];
  const handlers: Record<string, any[]> = {};
  const router: any = {};
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
    router[method] = (url: string, ...callbacks: any[]) => { handlers[`${method} ${url}`] = callbacks.flat(); };
  }
  const controller = Object.fromEntries(['getAll', 'getSop', 'create', 'update', 'remove'].map(action =>
    [action, (_req: any, _res: any) => calls.push(action)]));
  const module = loadModule('sops.routes.ts', {
    express: { Router: () => router }, './sops.controller': { sopsController: controller },
    '../../middlewares/validate': { validateParamId: (_req: any, _res: any, next: any) => next() },
    './sops.validator': { sopsValidator: [] },
    '../../middlewares/validator.middleware': { validate: (_req: any, _res: any, next: any) => next() }
  });
  module.default(router);
  return { handlers, calls };
}

function invoke(callbacks: any[], request: any) {
  let status = 200;
  let body: any;
  const response: any = { status: (value: number) => { status = value; return response; }, json: (value: any) => { body = value; return response; } };
  let index = 0;
  const next = (error?: any) => { assert.ifError(error); const callback = callbacks[index++]; if (callback) callback(request, response, next); };
  next();
  return { status, body };
}

test('SOP mutations reject users whose effective form action is disabled', () => {
  const { handlers, calls } = routes();
  const roleMenu = { master_form: { view: true }, form: { parent: 'master_form', view: true, add: false, edit: false, delete: false } };
  for (const endpoint of ['post /', 'put /:id', 'patch /:id', 'delete /:id']) {
    const response = invoke(handlers[endpoint], { roleMenu, user: { _id: userId, account_id: accountA, user_role: 'employee' } });
    assert.equal(response.status, 403, endpoint);
  }
  assert.equal(calls.length, 0, 'disabled authors must not reach persistence controllers');
  assert.ok(handlers['use /sops'], 'existing mount remains present');
});

test('SOP mutations preserve existing routes for authorized authors and enforce disabled parent', () => {
  const { handlers, calls } = routes();
  const roleMenu = { master_form: { view: true }, form: { parent: 'master_form', view: true, add: true, edit: true, delete: true } };
  for (const endpoint of ['post /', 'put /:id', 'patch /:id', 'delete /:id']) {
    assert.equal(invoke(handlers[endpoint], { roleMenu }).status, 200);
  }
  assert.equal(calls.length, 4);
  roleMenu.master_form.view = false;
  assert.equal(invoke(handlers['post /'], { roleMenu }).status, 403);
  assert.equal(calls.length, 4);
});

function serviceFixture() {
  const records: any[] = [
    { _id: sopId, account_id: accountA, visible: true, createdBy: userId, name: 'Own form', locationId, categoryId },
    { _id: foreignSopId, account_id: accountB, visible: true, createdBy: 'foreign-user', name: 'Foreign form', locationId, categoryId }
  ];
  const writes: any[] = [];
  const matches = (record: any, filter: any) => Object.entries(filter).every(([key, value]) => String(record[key]) === String(value));
  class Model {
    constructor(value: any) { Object.assign(this, value); }
    async save() { records.push(this); writes.push({ create: this }); return this; }
    static async findOneAndUpdate(filter: any, update: any) {
      const row = records.find(value => matches(value, filter));
      if (!row) return null;
      writes.push({ filter, update }); Object.assign(row, update.$set || update); return row;
    }
    static async findByIdAndUpdate(id: string, update: any) {
      const row = records.find(value => value._id === id);
      if (!row) return null;
      writes.push({ id, update }); Object.assign(row, update.$set || update); return row;
    }
  }
  const reference = (id: string) => ({ exists: async (filter: any) =>
    String(filter._id) === id && String(filter.account_id) === accountA && filter.visible === true ? { _id: id } : null });
  const { sopsService } = loadModule('sops.service.ts', {
    '../../models/sops.model': { SOPsModel: Model },
    '../../models/location.model': { LocationModel: reference(locationId) },
    '../../models/formCategory.model': { CategoryModel: reference(categoryId) }
  });
  return { sopsService, records, writes };
}

test('SOP update cannot reassign account or creation ownership through extra fields', async () => {
  const { sopsService, records } = serviceFixture();
  const body = { name: 'Updated own form', account_id: accountB, createdBy: 'foreign-user', visible: false,
    json_temp: { components: [{ type: 'textfield', key: 'reading', label: 'Reading' }] } };
  const result = await sopsService.updateSOPs(sopId, body, userId, accountA);
  assert.equal(result.name, 'Updated own form');
  assert.equal(records[0].account_id, accountA);
  assert.equal(records[0].createdBy, userId);
  assert.equal(records[0].visible, true);
  assert.equal(records[0].json_temp.components[0].key, 'reading');
  assert.equal(records[0].updatedBy, userId);
});

test('SOP update and delete use tenant predicates in the actual database mutation', async () => {
  const { sopsService, records, writes } = serviceFixture();
  assert.equal(await sopsService.updateSOPs(foreignSopId, { name: 'Unauthorized' }, userId, accountA), null);
  assert.equal(await sopsService.removeSOPs(foreignSopId, userId, accountA), null);
  assert.equal(records[1].name, 'Foreign form');
  assert.equal(records[1].visible, true);
  assert.equal(writes.length, 0);
  const removed = await sopsService.removeSOPs(sopId, userId, accountA);
  assert.equal(removed.visible, false);
  assert.equal(writes[0].filter.account_id, accountA);
});

test('SOP creation and update reject references outside the authenticated account', async () => {
  for (const field of ['locationId', 'categoryId']) {
    const { sopsService, writes } = serviceFixture();
    const body = { name: 'New form', locationId, categoryId, [field]: '64b000000000000000000099' };
    await assert.rejects(sopsService.createSOPs(body, accountA, userId), (error: any) => error.status === 403);
    await assert.rejects(sopsService.updateSOPs(sopId, body, userId, accountA), (error: any) => error.status === 403);
    assert.equal(writes.length, 0);
  }
});

test('SOP creation keeps ordinary schema content and authoritative own-account fields', async () => {
  const { sopsService } = serviceFixture();
  const created = await sopsService.createSOPs({ name: 'New form', description: 'Routine inspection', locationId, categoryId,
    account_id: accountB, createdBy: 'foreign-user', json_temp: { components: [{ type: 'number', key: 'temperature' }] } }, accountA, userId);
  assert.equal(created.account_id, accountA);
  assert.equal(created.createdBy, userId);
  assert.equal(created.name, 'New form');
  assert.equal(created.json_temp.components[0].type, 'number');
});
