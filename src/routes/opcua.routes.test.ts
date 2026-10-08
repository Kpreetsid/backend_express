import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { AssetModel } from '../models/asset.model';
import { callOpcuaProcessor, opcuaRoutes } from './opcua.routes';

const org = '64a000000000000000000001';
const assetId = '64a000000000000000000002';
const sourceConfig = { contract_version: 'pa_fan_source_v1', version: 1,
  units: { airflow: 'm3/h', inlet_pressure: 'kPa', yfj3_ai: 'mA' }, units_assumed: true,
  status_codes: { '2': 'starting', '3': 'running' } };

function environment(t: any): void {
  const before = { url: process.env.OPCUA_PROCESSOR_URL, secret: process.env.OPCUA_GATEWAY_SECRET };
  process.env.OPCUA_PROCESSOR_URL = 'http://processor.test/';
  process.env.OPCUA_GATEWAY_SECRET = 'test-secret';
  t.after(() => {
    if (before.url === undefined) delete process.env.OPCUA_PROCESSOR_URL; else process.env.OPCUA_PROCESSOR_URL = before.url;
    if (before.secret === undefined) delete process.env.OPCUA_GATEWAY_SECRET; else process.env.OPCUA_GATEWAY_SECRET = before.secret;
  });
}

async function save(body: any, updating = false): Promise<{ status: number; body: any }> {
  const router: any = opcuaRoutes();
  const path = updating ? '/mappings/:id' : '/mappings';
  const method = updating ? 'put' : 'post';
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]).route;
  const handler = route.stack[route.stack.length - 1].handle;
  return new Promise((resolve, reject) => {
    let status = 200;
    const response: any = { status(code: number) { status = code; return this; }, json(value: any) { resolve({ status, body: value }); } };
    handler({ params: { id: '7' }, body, user: { account_id: org, user_role: 'admin' } }, response, reject);
  });
}

test('PA fan mapping for an Other asset forwards only verified identity and configuration', async t => {
  environment(t);
  t.mock.method(AssetModel, 'findOne', (filter: any) => {
    assert.equal(filter.account_id, org);
    assert.equal(filter.visible, true);
    assert.equal(String(filter._id), assetId);
    return { select: () => ({ lean: async () => ({ _id: assetId, asset_name: 'PA fan 1', asset_type: 'Other' }) }) } as any;
  });
  t.mock.method(axios, 'request', async (config: any) => {
    assert.equal(config.headers['X-Opcua-Org'], org);
    assert.equal(config.headers['X-Opcua-Gateway-Key'], 'test-secret');
    assert.equal(config.data.asset_type, 'pa_fan');
    assert.equal(config.data.asset_id, assetId);
    assert.deepEqual(config.data.source_config, sourceConfig);
    assert.equal(config.data.account_id, undefined);
    assert.equal(config.data.customer_id, undefined);
    return { data: { mapping: { id: 7, asset_id: assetId, asset_type: 'pa_fan' }, cache_refreshed: true } } as any;
  });
  const result = await save({ source_asset_id: 'fan-plc', asset_id: assetId, asset_type: 'pa_fan',
    source_config: sourceConfig, enabled: true, validation_rules: {}, account_id: 'spoofed', customer_id: 'spoofed' });
  assert.equal(result.status, 201);
  assert.equal(result.body.mapping.asset_type, 'pa_fan');
  assert.equal(result.body.mapping.asset_name, 'PA fan 1');
});

test('generic fan classification remains fan unless PA fan is explicitly selected', async t => {
  environment(t);
  t.mock.method(AssetModel, 'findOne', () => ({ select: () => ({ lean: async () =>
    ({ _id: assetId, asset_name: 'Fan', asset_type: 'Fan_Blower' }) }) }) as any);
  const types: string[] = [];
  t.mock.method(axios, 'request', async (config: any) => {
    types.push(config.data.asset_type);
    return { data: { mapping: { asset_id: assetId, asset_type: config.data.asset_type } } } as any;
  });
  await save({ asset_id: assetId });
  await save({ asset_id: assetId, asset_type: 'pa_fan', source_config: sourceConfig });
  assert.deepEqual(types, ['fan', 'pa_fan']);
});

test('fan mapping updates verify the original and selected asset and pass optimistic version', async t => {
  environment(t);
  let assetChecks = 0;
  t.mock.method(AssetModel, 'findOne', () => {
    assetChecks++;
    return { select: () => ({ lean: async () => ({ _id: assetId, asset_name: 'Fan', asset_type: 'Other' }) }) } as any;
  });
  const calls: any[] = [];
  t.mock.method(axios, 'request', async (config: any) => {
    calls.push(config);
    return { data: config.method === 'GET' ? { asset_id: assetId } : { mapping: { asset_id: assetId, asset_type: 'pa_fan' } } } as any;
  });
  const result = await save({ asset_id: assetId, asset_type: 'pa_fan', expected_version: 4, source_config: sourceConfig }, true);
  assert.equal(result.status, 200);
  assert.equal(assetChecks, 2);
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].data.expected_version, 4);
  assert.equal(calls[1].url, 'http://processor.test/internal/opcua/mappings/7/');
});

test('chiller cache refresh verifies asset access and forwards pending status from the processor', async t => {
  environment(t);
  t.mock.method(AssetModel, 'findOne', (filter: any) => {
    assert.equal(filter.account_id, org); assert.equal(filter.visible, true);
    assert.equal(String(filter._id), assetId);
    return { select: () => ({ lean: async () => ({ _id: assetId, asset_name: 'Chiller' }) }) } as any;
  });
  const calls: any[] = [];
  t.mock.method(axios, 'request', async (config: any) => {
    calls.push(config);
    return { data: config.method === 'GET' ? { asset_id: assetId, asset_type: 'chiller' } :
      { cache_refreshed: false, mapping: { asset_id: assetId, asset_type: 'chiller', cache_refresh_pending: true } } } as any;
  });
  const router: any = opcuaRoutes();
  const route = router.stack.find((layer: any) => layer.route?.path === '/mappings/:id/refresh').route;
  const handler = route.stack[route.stack.length - 1].handle;
  const result: any = await new Promise((resolve, reject) => {
    let status = 200;
    const response: any = { status(code: number) { status = code; return this; },
      json(body: any) { resolve({ status, body }); } };
    handler({ params: { id: '7' }, body: {}, user: { account_id: org, user_role: 'admin' } }, response, reject);
  });
  assert.equal(result.status, 200); assert.equal(result.body.cache_refreshed, false);
  assert.equal(result.body.mapping.cache_refresh_pending, true);
  assert.equal(calls[1].method, 'POST'); assert.equal(calls[1].url, 'http://processor.test/internal/opcua/mappings/7/refresh/');
  assert.equal(calls[1].headers['X-Opcua-Org'], org);
});

test('invalid selected type or inaccessible asset never reaches the processor', async t => {
  environment(t);
  const asset = t.mock.method(AssetModel, 'findOne', () => ({ select: () => ({ lean: async () =>
    ({ _id: assetId, asset_name: 'Unit', asset_type: 'Other' }) }) }) as any);
  const proxy = t.mock.method(axios, 'request', async () => { throw new Error('Unexpected processor call'); });
  for (const type of ['id_fan', ['pa_fan'], { type: 'pa_fan' }]) {
    await assert.rejects(save({ asset_id: assetId, asset_type: type }), (error: any) => error.status === 400);
  }
  asset.mock.mockImplementation(() => ({ select: () => ({ lean: async () => null }) }) as any);
  await assert.rejects(save({ asset_id: assetId, asset_type: 'pa_fan' }), (error: any) => error.status === 403);
  assert.equal(proxy.mock.callCount(), 0);
});

test('processor fan validation, conflict and cache errors remain actionable', async t => {
  environment(t);
  const request = t.mock.method(axios, 'request', async () => ({ data: {} }) as any);
  for (const [status, data, message] of [
    [400, { source_config: ['Unsupported unit for airflow'] }, 'Unsupported unit for airflow'],
    [409, { detail: 'Mapping changed while saving.' }, 'Mapping changed'],
    [503, { detail: 'Mapping not changed: Redis cache invalidation failed.' }, 'Mapping not changed'],
  ] as [number, any, string][]) {
    request.mock.mockImplementation(async () => { throw Object.assign(new Error('processor'), { isAxiosError: true, response: { status, data } }); });
    await assert.rejects(callOpcuaProcessor(org, '', 'POST', {}), (error: any) => error.status === status && error.message.includes(message));
  }
  request.mock.mockImplementation(async () => { throw Object.assign(new Error('network'), { isAxiosError: true }); });
  await assert.rejects(callOpcuaProcessor(org, ''), (error: any) => error.status === 503 && error.message.includes('unavailable'));
});
