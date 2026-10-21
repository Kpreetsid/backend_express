import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetModel } from '../../models/asset.model';
import { MapUserAssetLocationModel } from '../../models/mapUserLocation.model';
import { buildComponentTemplates } from '../../catalog/asset-train-catalog';
import { buildAssetTrainCreationPlan, createReviewedAssetTrain, validateReviewedComponents } from './asset-train-creation';
import { requireProcessorBaseUrl } from '../../utils/processor-url';
import mongoose from 'mongoose';

const accountId = '64a000000000000000000001';
const userId = '64a000000000000000000002';
function request() {
  return {
    asset_name: 'Boiler feed train', asset_type: 'Boiler Feed Pump', top_level: true,
    locationId: '64a000000000000000000003', asset_class: 'class_2', asset_timezone: 'Asia/Calcutta',
    alarmType: ['alert', 'critical'], userIdList: [userId, userId, '64a000000000000000000004'],
    manufacturer: 'Parent manufacturer', images: [{ file: 'parent.png' }],
    components: buildComponentTemplates('Boiler Feed Pump').map((component, index) => ({
      key: `component_${index + 1}`, name: component.name, asset_type: component.asset_type,
      component_type: component.component_type, component_role: component.component_role
    }))
  };
}

test('creates a parent and every component directly below it with inherited fields and empty details', async () => {
  const plan = buildAssetTrainCreationPlan(request(), accountId, userId);
  const [parent, ...children] = plan.assets;
  assert.equal(children.length, 5);
  assert.deepEqual(children.map(child => child.asset_name), ['Motor', 'Turbine', 'Coupling', 'Pump Shaft', 'Impellers']);
  assert.equal(String(parent.top_level_asset_id), String(parent._id));
  for (const [index, child] of children.entries()) {
    assert.equal(String(child.parent_id), String(parent._id));
    assert.equal(String(child.top_level_asset_id), String(parent._id));
    assert.equal(child.account_id, accountId);
    assert.equal(child.createdBy, userId);
    assert.equal(child.locationId, parent.locationId);
    assert.equal(child.asset_class, parent.asset_class);
    assert.equal(child.asset_timezone, parent.asset_timezone);
    assert.deepEqual(child.alarmType, parent.alarmType);
    assert.deepEqual(child.images, []);
    assert.equal(child.manufacturer, '');
    assert.equal(plan.components[index].asset_id, String(child._id));
    assert.equal(plan.components[index].key, child.diagnostic_component_key);
  }
  // Exercise the real Mongo schemas without opening a database connection.
  for (const asset of plan.assets) await new AssetModel(asset).validate();
  for (const mapping of plan.mappings) await new MapUserAssetLocationModel(mapping).validate();
  assert.equal(plan.mappings.length, plan.assets.length * 2);
  assert.equal(plan.mappings.every(item => item.alert && item.critical && !item.danger && !item.sendMail), true);
});

test('uses the reviewed list, including removed components and separately numbered children', () => {
  const body = request();
  body.components = [body.components[0], {
    ...body.components[4], key: 'impeller_1', name: 'Impeller 1'
  }, { ...body.components[4], key: 'impeller_2', name: 'Impeller 2' }];
  const plan = buildAssetTrainCreationPlan(body, accountId, userId);
  assert.deepEqual(plan.components.map(item => item.name), ['Motor', 'Impeller 1', 'Impeller 2']);
  assert.equal(new Set(plan.components.map(item => item.asset_id)).size, 3);
  body.components = [];
  assert.equal(buildAssetTrainCreationPlan(body, accountId, userId).assets.length, 1);
});

test('rejects invalid children, mismatched types/roles, duplicated keys/names, and unsafe hierarchy requests', () => {
  const cases: Array<(body: any) => void> = [
    body => body.components.push({ ...body.components[0] }),
    body => body.components[1].name = ' motor ',
    body => body.components[0].name = ' ',
    body => body.components[0].key = 'x'.repeat(151),
    body => body.components[0].asset_type = 'Unknown Machine',
    body => body.components[0].component_type = 'pump',
    body => body.components[0].component_role = 'driven',
    body => body.components = Array(2000).fill(body.components[0]),
    body => body.top_level = false,
    body => body.parent_id = '64a000000000000000000003',
    body => body.asset_type = 'Motor'
  ];
  for (const mutate of cases) {
    const body = request(); mutate(body);
    assert.throws(() => validateReviewedComponents(body), (error: any) => error.status === 400);
  }
});

test('does not permit caller supplied IDs/account ownership to override the creation plan', () => {
  const body: any = { ...request(), _id: 'malicious', account_id: 'another-account', createdBy: 'another-user',
    top_level_asset_id: 'another-root', visible: false };
  const plan = buildAssetTrainCreationPlan(body, accountId, userId);
  assert.equal(plan.assets[0].account_id, accountId);
  assert.equal(plan.assets[0].createdBy, userId);
  assert.notEqual(String(plan.assets[0]._id), 'malicious');
  assert.equal(plan.assets.every(asset => asset.visible === true), true);
});

test('persists the complete plan before health initialization and returns persisted child IDs', async () => {
  const stages: string[] = [];
  const result = await createReviewedAssetTrain(request(), accountId, userId, {
    preflight: async plan => { stages.push('preflight'); assert.equal(plan.assets.length, 6); },
    persist: async plan => { stages.push('persist'); assert.equal(plan.mappings.length, 12); },
    initializeHealth: async () => { stages.push('health'); },
    readRoot: async rootId => { stages.push('read'); return [{ id: rootId }]; },
    rollback: async () => { throw new Error('Unexpected rollback'); }
  });
  assert.deepEqual(stages, ['preflight', 'persist', 'health', 'read']);
  assert.equal(result.components.length, 5);
  assert.equal(result.components.every(component => component.asset_id !== result.data[0].id), true);
});

test('rolls back every planned ID after partial persistence, processor failure or a failed result read', async () => {
  for (const failingStage of ['persist', 'health', 'read']) {
    let plannedIds: string[] = [];
    let cleanupIds: string[] = [];
    await assert.rejects(createReviewedAssetTrain(request(), accountId, userId, {
      preflight: async plan => { plannedIds = plan.assets.map(asset => String(asset._id)); },
      persist: async () => { if (failingStage === 'persist') throw new Error('failed'); },
      initializeHealth: async () => { if (failingStage === 'health') throw new Error('failed'); },
      readRoot: async () => { if (failingStage === 'read') throw new Error('failed'); return [{}]; },
      rollback: async ids => { cleanupIds = ids; }
    }), /failed/);
    assert.deepEqual(cleanupIds, plannedIds);
    assert.equal(cleanupIds.length, 6);
  }
});

test('preflight failure performs no persistence, processor call, or rollback', async () => {
  const unexpected = async () => { throw new Error('Unexpected side effect'); };
  await assert.rejects(createReviewedAssetTrain(request(), accountId, userId, {
    preflight: async () => { throw new Error('preflight rejected'); }, persist: unexpected,
    initializeHealth: unexpected, readRoot: unexpected, rollback: unexpected
  }), /preflight rejected/);
});

test('missing processor URLs produce a clear configuration error', () => {
  for (const value of [undefined, '', '/asset_health_status/', 'ftp://processor']) {
    assert.throws(() => requireProcessorBaseUrl(value), (error: any) =>
      error.status === 503 && error.code === 'PROCESSOR_API_NOT_CONFIGURED');
  }
  assert.equal(requireProcessorBaseUrl('http://localhost:8000/api/'), 'http://localhost:8000/api');
});

test('the database adapter maps active and inactive users while checking ownership, capacity and compensation', async t => {
  const { assetService } = require('./asset.service');
  const { LocationModel } = require('../../models/location.model');
  const { UserModel } = require('../../models/user.model');
  const { subscriptionLimitService } = require('../company/subscriptionLimit.service');
  const { mapUserToAssetService } = require('../../transaction/mapUserAsset/userAsset.service');
  const { processorAPIService } = require('../../api-processor');
  const { externalAPI } = require('../../configDB');
  const savedUrl = externalAPI.URL;
  externalAPI.URL = 'http://processor.test';
  t.after(() => { externalAPI.URL = savedUrl; });
  const session: any = {
    startTransaction: () => {}, commitTransaction: async () => {}, abortTransaction: async () => {},
    endSession: async () => {}, inTransaction: () => true
  };
  t.mock.method(mongoose, 'startSession', async () => session);
  const location = t.mock.method(LocationModel, 'exists', async () => ({ _id: request().locationId }));
  const locationUsers = [
    { _id: userId, account_id: accountId, user_status: 'active' },
    { _id: '64a000000000000000000004', account_id: accountId, user_status: 'inactive' }
  ];
  const users = t.mock.method(UserModel, 'countDocuments', async (query: any) => locationUsers.filter(user =>
    query._id.$in.includes(user._id) && user.account_id === query.account_id
    && (!query.user_status || user.user_status === query.user_status)
  ).length);
  const capacity = t.mock.method(subscriptionLimitService, 'assertCanCreate', async () => ({} as any));
  const assets = t.mock.method(AssetModel, 'insertMany', async () => []);
  const mappings = t.mock.method(mapUserToAssetService, 'createMapUserAssets', async () => []);
  const health = t.mock.method(processorAPIService, 'setAssetHealthStatus', async () => ({ status: true }));
  t.mock.method(assetService, 'getAllAssets', async (match: any) => [{ id: String(match._id) }]);
  const deletedMappings = t.mock.method(MapUserAssetLocationModel, 'deleteMany', async () => ({} as any));
  const deletedAssets = t.mock.method(AssetModel, 'deleteMany', async () => ({} as any));

  const result = await assetService.createAssetTrain(request(), accountId, userId, 'token');
  assert.equal(result.components.length, 5);
  assert.deepEqual(location.mock.calls[0].arguments[0], {
    _id: request().locationId, account_id: accountId, visible: true
  });
  assert.deepEqual(users.mock.calls[0].arguments[0], {
    _id: { $in: locationUsers.map(user => user._id) }, account_id: accountId
  });
  assert.deepEqual(capacity.mock.calls[0].arguments, [accountId, 'asset', 6, session]);
  assert.equal(((assets.mock.calls[0].arguments as any[])[1] as any).session, session);
  assert.equal(mappings.mock.calls[0].arguments[1], session);
  const persistedMappings: any[] = mappings.mock.calls[0].arguments[0];
  for (const asset of (assets.mock.calls[0].arguments as any[])[0]) {
    assert.deepEqual(persistedMappings.filter(mapping => String(mapping.assetId) === String(asset._id))
      .map(mapping => mapping.userId), locationUsers.map(user => user._id));
  }
  assert.equal(health.mock.calls[0].arguments[0].length, 12);
  assert.equal(deletedAssets.mock.callCount(), 0);

  health.mock.mockImplementation(async () => { throw new Error('processor unavailable'); });
  await assert.rejects(assetService.createAssetTrain(request(), accountId, userId, 'token'), /processor unavailable/);
  const assetFilter: any = deletedAssets.mock.calls[0].arguments[0];
  const mappingFilter: any = deletedMappings.mock.calls[0].arguments[0];
  assert.equal(assetFilter.account_id, accountId);
  assert.equal(mappingFilter.account_id, accountId);
  assert.equal(assetFilter._id.$in.length, 6);
  assert.deepEqual(mappingFilter.assetId.$in, assetFilter._id.$in);

  const insertedCount = assets.mock.callCount();
  const cleanupCount = deletedAssets.mock.callCount();
  users.mock.mockImplementation(async () => 1);
  await assert.rejects(assetService.createAssetTrain(request(), accountId, userId, 'token'), /users must belong to your account/);
  assert.equal(assets.mock.callCount(), insertedCount);
  assert.equal(deletedAssets.mock.callCount(), cleanupCount);
  users.mock.mockImplementation(async () => 2);
  capacity.mock.mockImplementation(async () => { throw new Error('subscription capacity reached'); });
  await assert.rejects(assetService.createAssetTrain(request(), accountId, userId, 'token'), /subscription capacity reached/);
  assert.equal(assets.mock.callCount(), insertedCount);
});
