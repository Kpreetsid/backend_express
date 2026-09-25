const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const assetId = '68c7f66906af86cb16982e0d';

test('mapping forwards explicit source configuration without replacing trusted identity', async () => {
  const f = fixture();
  const config = { contract_version: 'chiller_source_v1', version: 1, flow_unit: 'm3/h' };
  await f.request('post', '/mappings', { body: {
    source_asset_id: 'plc-123', asset_id: assetId, enabled: true, validation_rules: {}, source_config: config,
  } });
  assert.equal(f.calls[0].data.source_config, config);
  assert.equal(f.calls[0].data.asset_type, 'chiller');
  assert.equal(f.calls[0].headers['X-Opcua-Org'], 'trusted-org');
});
function fixture() {
  const routes = [];
  const globals = [];
  const calls = [];
  let assetAllowed = true;
  const permission = (module, action) => (req, res, next) => {
    if ((action === 'view' && req.view !== false) || (action === 'attach_sensor' && req.edit === true)) next();
    else next(Object.assign(new Error('Forbidden'), { status: 403 }));
  };
  const router = { use: fn => globals.push(fn) };
  for (const method of ['get', 'post', 'put']) router[method] = (path, ...handlers) => routes.push({ method, path, handlers });
  const axios = {
    request: async options => {
      calls.push(options);
      if (options.method === 'GET') return { data: { id: 1, asset_id: assetId } };
      return { data: { mapping: { id: 1, ...options.data }, cache_refreshed: true } };
    },
    isAxiosError: error => error.isAxiosError === true,
  };
  const dependencies = {
    express: { Router: () => router }, axios,
    lodash: { get: (obj, key) => obj[key] },
    mongoose: { Types: { ObjectId: class { constructor(id) { this.id = id; } toString() { return this.id; } } } },
    '../middlewares/permission': { hasRolePermission: permission, hasAccountFeature: permission },
    '../models/asset.model': { AssetModel: { findOne: filter => ({ select: () => ({ lean: async () => {
      assert.equal(filter.account_id, 'trusted-org');
      return assetAllowed ? { _id: assetId, asset_name: 'Plant chiller', asset_type: 'Chillers' } : null;
    } }) }) } },
    '../utils/roleFilter': { applyRoleFilter: async ({ user, baseFilter }) => ({ ...baseFilter, account_id: user.account_id }) },
  };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../src/routes/opcua.routes.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  const env = { OPCUA_PROCESSOR_URL: 'https://processor.test', OPCUA_GATEWAY_SECRET: 'unit-test-only' };
  vm.runInNewContext(js, { exports, process: { env }, require: name => {
    assert.ok(dependencies[name], `Unexpected dependency ${name}`); return dependencies[name];
  } });
  exports.opcuaRoutes();
  async function request(method, path, extra = {}) {
    const route = routes.find(row => row.method === method && row.path === path);
    assert.ok(route, 'route exists');
    const req = { user: { account_id: 'trusted-org' }, view: true, edit: true, params: { id: '1' }, query: {}, body: {}, ...extra };
    return new Promise((resolve, reject) => {
      let index = 0;
      const chain = [...globals, ...route.handlers];
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ code: this.statusCode, data }); } };
      const next = error => { if (error) reject(error); else chain[index++](req, res, next); };
      next();
    });
  }
  return { request, calls, env, exports, denyAsset: () => { assetAllowed = false; } };
}

test('manual mapping uses authenticated org and Mongo asset type, not supplied identity metadata', async () => {
  const f = fixture();
  const result = await f.request('post', '/mappings', { body: {
    source_asset_id: 'plc-123', asset_id: assetId, enabled: true, validation_rules: {},
    org_id: 'attacker-org', customer_id: 'ignored', equipment_id: 'ignored', asset_type: 'wrong',
  } });
  assert.equal(result.code, 201);
  assert.equal(f.calls[0].headers['X-Opcua-Org'], 'trusted-org');
  assert.equal(f.calls[0].data.asset_type, 'chiller');
  assert.equal(f.calls[0].data.source_asset_id, 'plc-123');
  assert.equal(f.calls[0].data.customer_id, undefined);
  assert.equal(f.calls[0].data.org_id, undefined);
});
test('write permission is required', async () => {
  const f = fixture();
  await assert.rejects(f.request('post', '/mappings', { edit: false }), e => e.status === 403);
  assert.equal(f.calls.length, 0);
});
test('asset outside permitted scope cannot be mapped', async () => {
  const f = fixture(); f.denyAsset();
  await assert.rejects(f.request('post', '/mappings', { body: { asset_id: assetId } }), e => e.status === 403);
  assert.equal(f.calls.length, 0);
});
test('malformed Mongo asset ID is rejected before processor request', async () => {
  const f = fixture();
  await assert.rejects(f.request('post', '/mappings', { body: { asset_id: 'invalid' } }), e => e.status === 400);
  assert.equal(f.calls.length, 0);
});
test('missing processor secret fails closed', async () => {
  const f = fixture(); delete f.env.OPCUA_GATEWAY_SECRET;
  await assert.rejects(f.exports.callOpcuaProcessor('trusted-org', ''), e => e.status === 503);
  assert.equal(f.calls.length, 0);
});
test('uses existing processor URL when no OPC-UA override is configured', async () => {
  const f = fixture(); delete f.env.OPCUA_PROCESSOR_URL;
  f.env.PROCESSOR_API_URL = 'http://127.0.0.1:8000/';
  await f.exports.callOpcuaProcessor('trusted-org', '');
  assert.equal(f.calls[0].url, 'http://127.0.0.1:8000/internal/opcua/mappings/');
});
test('missing service URL explains the required configuration', async () => {
  const f = fixture(); delete f.env.OPCUA_PROCESSOR_URL;
  await assert.rejects(f.exports.callOpcuaProcessor('trusted-org', ''), e => e.status === 503 && e.message.includes('OPCUA_PROCESSOR_URL'));
  assert.equal(f.calls.length, 0);
});
test('update checks access to existing mapped asset before changing it', async () => {
  const f = fixture(); f.denyAsset();
  await assert.rejects(f.request('put', '/mappings/:id', { body: { asset_id: assetId } }), e => e.status === 403);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].method, 'GET');
});
