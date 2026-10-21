import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose, { Types } from 'mongoose';
import { buildChildComponent, componentIdentityForUpdate, deleteConfirmedChild } from './asset-component-management';
import { AssetModel } from '../../models/asset.model';
import { MapUserAssetLocationModel } from '../../models/mapUserLocation.model';

const accountId = new Types.ObjectId('64a000000000000000000001');
const userId = new Types.ObjectId('64a000000000000000000002');
const rootId = new Types.ObjectId('64a000000000000000000003');
const childId = new Types.ObjectId('64a000000000000000000004');
const root = { _id: rootId, account_id: accountId, top_level: true, visible: true,
  locationId: new Types.ObjectId('64a000000000000000000005'), asset_class: 'class_2',
  asset_timezone: 'Asia/Calcutta', alarmType: ['danger'], snoozeAlarm: true, snoozeValue: 10 };

test('manual components use one direct child, inherited settings and selected alarm mappings', async () => {
  const plan = buildChildComponent(root, { name: ' Spare motor ', asset_type: 'Motor', _id: rootId, account_id: userId }, accountId, userId, [
    { userId, alert: false, danger: true, critical: false, sendMail: true }, { userId, danger: true, sendMail: true }
  ]);
  assert.equal(plan.asset.asset_name, 'Spare motor');
  assert.equal(plan.asset.asset_type, 'Motor');
  assert.equal(plan.asset.parent_id, rootId);
  assert.equal(plan.asset.top_level_asset_id, rootId);
  assert.equal(plan.asset.account_id, accountId);
  assert.equal(plan.asset.asset_class, 'class_2');
  assert.equal(plan.asset.asset_timezone, root.asset_timezone);
  assert.equal(plan.asset.snoozeValue, 10);
  assert.deepEqual(plan.asset.images, []);
  assert.equal(plan.asset.diagnostic_component_type, 'motor');
  assert.equal(plan.asset.diagnostic_component_role, 'driver');
  assert.equal(plan.mappings.length, 1);
  assert.equal(plan.mappings[0].assetId, plan.asset._id);
  assert.equal(plan.mappings[0].danger, true);
  assert.equal(plan.mappings[0].alert, false);
  await new AssetModel(plan.asset).validate();
  await new MapUserAssetLocationModel(plan.mappings[0]).validate();
});

test('component creation rejects unavailable roots, foreign accounts, empty names and unknown types', () => {
  for (const invalidRoot of [null, { ...root, top_level: false }, { ...root, visible: false }, { ...root, account_id: userId }]) {
    assert.throws(() => buildChildComponent(invalidRoot, { name: 'Motor', asset_type: 'Motor' }, accountId, userId, []));
  }
  for (const body of [{ name: ' ', asset_type: 'Motor' }, { name: 'x'.repeat(201), asset_type: 'Motor' }, { name: 'Motor', asset_type: 'invented' }]) {
    assert.throws(() => buildChildComponent(root, body, accountId, userId, []));
  }
});

test('a child is hidden only after the processor acknowledges that exact ID', async () => {
  const stages: string[] = [];
  await deleteConfirmedChild(String(childId), {
    deleteEndpoints: async () => { stages.push('endpoints'); return { status: true, data: { asset_id: String(childId) } }; },
    hideChild: async () => { stages.push('child'); }
  });
  assert.deepEqual(stages, ['endpoints', 'child']);
  for (const response of [{ status: false }, { status: true, data: { asset_id: String(rootId) } }, {}]) {
    await assert.rejects(deleteConfirmedChild(String(childId), {
      deleteEndpoints: async () => response, hideChild: async () => { throw new Error('Must not hide'); }
    }), /not confirmed/);
  }
  await assert.rejects(deleteConfirmedChild(String(childId), {
    deleteEndpoints: async () => { throw new Error('offline'); }, hideChild: async () => { throw new Error('Must not hide'); }
  }), /offline/);
  let attempts = 0;
  const retryable = {
    deleteEndpoints: async () => ({ status: true, data: { asset_id: String(childId) } }),
    hideChild: async () => { if (++attempts === 1) throw new Error('Mongo unavailable'); }
  };
  await assert.rejects(deleteConfirmedChild(String(childId), retryable), /Mongo unavailable/);
  await deleteConfirmedChild(String(childId), retryable);
  assert.equal(attempts, 2);
});

test('editing a component preserves identity and hierarchy and updates the diagnostic family', () => {
  const previous = { ...root, _id: childId, parent_id: rootId, top_level_asset_id: rootId, top_level: false,
    diagnostic_component_key: 'saved_key', asset_type: 'Motor' };
  const updated = componentIdentityForUpdate(previous, { asset_type: 'Turbine', asset_name: 'New turbine',
    parent_id: userId, top_level: true, account_id: userId, diagnostic_component_key: 'replaced_key' });
  assert.equal(updated.asset_name, 'New turbine');
  assert.equal(updated.account_id, accountId);
  assert.equal(updated.parent_id, rootId);
  assert.equal(updated.top_level, false);
  assert.equal(updated.diagnostic_component_key, 'saved_key');
  assert.equal(updated.diagnostic_component_type, 'turbine');
  assert.throws(() => componentIdentityForUpdate(previous, { asset_type: 'invented' }), /supported component type/);
});

test('deletion requires explicit confirmation and a direct leaf in the account', async t => {
  const { assetService } = require('./asset.service');
  const { processorAPIService } = require('../../api-processor');
  let child: any = { _id: childId, parent_id: rootId, account_id: accountId, asset_type: 'Motor', diagnostic_component_key: 'key' };
  const reads = t.mock.method(AssetModel, 'findOne', ((query: any) => ({ lean: async () => String(query._id) === String(rootId) ? root : child })) as any);
  const descendants = t.mock.method(AssetModel, 'exists', async () => null as any);
  const processor = t.mock.method(processorAPIService, 'deleteChildComponent', async () => ({ status: true, data: { asset_id: String(childId) } }));
  const hide = t.mock.method(assetService, 'removeById', async () => true);
  await assert.rejects(assetService.removeChildComponent(String(rootId), String(childId), accountId, userId, 'token', false), /Confirm deletion/);
  assert.equal(reads.mock.callCount(), 0);
  await assetService.removeChildComponent(String(rootId), String(childId), accountId, userId, 'token', true, 'true');
  assert.deepEqual(processor.mock.calls[0].arguments, [String(rootId), String(childId), 'token', userId, 'true']);
  assert.deepEqual((hide.mock.calls[0].arguments as any[])[2], [String(childId)]);
  assert.equal((reads.mock.calls[1].arguments[0] as any).account_id, accountId);
  assert.equal((reads.mock.calls[1].arguments[0] as any).parent_id, String(rootId));
  descendants.mock.mockImplementation(async () => ({ _id: rootId }));
  await assert.rejects(assetService.removeChildComponent(String(rootId), String(childId), accountId, userId, 'token', true), /Remove those children/);
  assert.equal(processor.mock.callCount(), 1);
  descendants.mock.mockImplementation(async () => null);
  child = null;
  await assert.rejects(assetService.removeChildComponent(String(rootId), String(childId), accountId, userId, 'token', true), /direct child/);
  assert.equal(processor.mock.callCount(), 1);
});

test('manual creation enforces capacity and sibling names and compensates only its new ID', async t => {
  const { assetService } = require('./asset.service');
  const { processorAPIService } = require('../../api-processor');
  const { subscriptionLimitService } = require('../company/subscriptionLimit.service');
  const { mapUserToAssetService } = require('../../transaction/mapUserAsset/userAsset.service');
  const { externalAPI } = require('../../configDB');
  const previousUrl = externalAPI.URL;
  externalAPI.URL = 'http://processor.test';
  t.after(() => { externalAPI.URL = previousUrl; });
  t.mock.method(AssetModel, 'findOne', (() => ({ lean: async () => root })) as any);
  t.mock.method(MapUserAssetLocationModel, 'find', (() => ({ lean: async () => [{ userId, danger: true }] })) as any);
  const descendants = t.mock.method(assetService, 'getAllChildAssetsRecursive', async () => []);
  const session: any = { startTransaction: () => {}, commitTransaction: async () => {}, abortTransaction: async () => {}, endSession: async () => {}, inTransaction: () => true };
  t.mock.method(mongoose, 'startSession', async () => session);
  const quota = t.mock.method(subscriptionLimitService, 'assertCanCreate', async () => ({} as any));
  const insert = t.mock.method(AssetModel, 'insertMany', async () => []);
  const maps = t.mock.method(mapUserToAssetService, 'createMapUserAssets', async () => []);
  const processor = t.mock.method(processorAPIService, 'setAssetHealthStatus', async () => ({ status: true }));
  t.mock.method(assetService, 'getAllAssets', async (query: any) => [{ id: String(query._id) }]);
  const cleanupAsset = t.mock.method(AssetModel, 'deleteOne', async () => ({} as any));
  const cleanupMappings = t.mock.method(MapUserAssetLocationModel, 'deleteMany', async () => ({} as any));
  const body = { name: 'Spare motor', asset_type: 'Motor' };
  await assetService.createChildComponent(String(rootId), body, accountId, userId, 'token');
  assert.deepEqual(quota.mock.calls[0].arguments, [accountId, 'asset', 1, session]);
  assert.equal((insert.mock.calls[0].arguments as any[])[1].session, session);
  assert.equal(maps.mock.calls[0].arguments[1], session);
  assert.equal(cleanupAsset.mock.callCount(), 0);
  processor.mock.mockImplementation(async () => { throw new Error('offline'); });
  await assert.rejects(assetService.createChildComponent(String(rootId), body, accountId, userId, 'token'), /offline/);
  const assetFilter = cleanupAsset.mock.calls[0].arguments[0] as any;
  const mappingFilter = cleanupMappings.mock.calls[0].arguments[0] as any;
  assert.equal(assetFilter.account_id, accountId);
  assert.equal(String(assetFilter._id), String(mappingFilter.assetId));
  assert.notEqual(String(assetFilter._id), String(rootId));
  const calls = insert.mock.callCount();
  descendants.mock.mockImplementation(async () => [{ parent_id: rootId, asset_name: 'SPARE MOTOR' }]);
  await assert.rejects(assetService.createChildComponent(String(rootId), body, accountId, userId, 'token'), /already exists/);
  descendants.mock.mockImplementation(async () => Array(1999).fill({}));
  await assert.rejects(assetService.createChildComponent(String(rootId), body, accountId, userId, 'token'), /2,000 assets/);
  assert.equal(insert.mock.callCount(), calls);
});
