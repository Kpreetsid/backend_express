import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { MapUserAssetLocationModel } from '../models/mapUserLocation.model';
import { UserModel } from '../models/user.model';
import { AssetModel } from '../models/asset.model';

const accountId = '64a000000000000000000001';
const userId = '64a000000000000000000002';
const assetId = '64a000000000000000000003';
const mappingId = '64a000000000000000000004';
const foreignId = '64a000000000000000000005';
const parentId = '64a000000000000000000006';
const query = (value: any) => ({ select() { return this; }, lean: async () => value });

test('new mappings default every channel severity to false without changing legacy flags', () => {
  const mapping = new MapUserAssetLocationModel({ userId: new Types.ObjectId() }).toObject();
  for (const channel of ['email', 'push', 'sms', 'whatsapp']) {
    assert.deepEqual((mapping.notifications as any)?.[channel], { alert: false, danger: false, critical: false });
  }
  assert.equal(mapping.sendMail, true);
  assert.equal(mapping.alert, true);
});

test('notification patches accept only known nonempty boolean leaves', () => {
  const { notificationPatch } = require('./userNotifications');
  assert.deepEqual(notificationPatch({ notifications: { email: { alert: false }, sms: { critical: true } } }), {
    'notifications.email.alert': false, 'notifications.sms.critical': true
  });
  for (const body of [null, [], {}, { notifications: {} }, { notifications: [] },
    { notifications: { email: {} } }, { notifications: { fax: { alert: true } } },
    { notifications: { email: { alert: 'true' } } }, { notifications: { email: { alert: 1 } } },
    { notifications: { email: { alert: null } } }, { notifications: { email: { other: true } } },
    { notifications: { email: { alert: true } }, sendMail: false },
    { notifications: { 'email.alert': true } }]) {
    assert.throws(() => notificationPatch(body), (error: any) => error.status === 400);
  }
});

test('legacy normalization ignores legacy mail flags and returns exactly twelve booleans', () => {
  const { normalizeNotifications } = require('./userNotifications');
  const value = normalizeNotifications({ email: { alert: true, danger: 'true' }, push: null });
  assert.equal(value.email.alert, true);
  assert.equal(value.email.danger, false);
  assert.equal(Object.values(value).flatMap(levels => Object.values(levels as object)).length, 12);
  assert.equal(Object.values(value).flatMap(levels => Object.values(levels as object)).filter(Boolean).length, 1);
});

test('GET returns only tenant asset assignments with hierarchy context and normalized legacy notifications', async t => {
  const { getUserNotifications } = require('./userNotifications');
  t.mock.method(UserModel, 'findOne', (filter: any) => {
    assert.deepEqual(filter, { _id: userId, account_id: accountId }); return query({ _id: userId });
  });
  t.mock.method(AssetModel, 'find', (filter: any) => {
    assert.deepEqual(filter, { account_id: accountId, visible: true });
    return query([{ _id: assetId, asset_name: 'Motor', parent_id: parentId }, { _id: parentId, asset_name: 'Train' }]);
  });
  t.mock.method(MapUserAssetLocationModel, 'find', (filter: any) => {
    assert.equal(filter.userId, userId);
    assert.deepEqual(filter.assetId, { $in: [assetId, parentId] });
    assert.deepEqual(filter.$or, [{ account_id: accountId }, { account_id: { $exists: false } }]);
    return query([{ _id: mappingId, userId, assetId, sendMail: true, alert: true }]);
  });
  const result = await getUserNotifications(accountId, userId);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.data[0].asset, { id: assetId, name: 'Motor', parentId });
  assert.equal(result.data[0].notifications.email.alert, false);
  assert.deepEqual(result.data[0].assetAncestors, [{ id: parentId, name: 'Train' }]);
});

test('GET returns 404 for nonexistent or foreign users, but an empty assigned list is valid', async t => {
  const { getUserNotifications } = require('./userNotifications');
  t.mock.method(UserModel, 'findOne', () => query(null));
  await assert.rejects(getUserNotifications(accountId, userId), (e: any) => e.status === 404);
  t.mock.method(UserModel, 'findOne', () => query({ _id: userId }));
  t.mock.method(AssetModel, 'find', () => query([]));
  assert.deepEqual(await getUserNotifications(accountId, userId), { data: [] });
});

test('PATCH updates only supplied notification leaves with validators and no legacy flag writes', async t => {
  const { patchUserNotifications } = require('./userNotifications');
  const mapping = { _id: mappingId, userId, assetId, sendMail: true, alert: true, notifications: { email: { alert: true } } };
  t.mock.method(MapUserAssetLocationModel, 'findOne', (filter: any) => {
    assert.equal(filter._id, mappingId);
    assert.deepEqual(filter.$or, [{ account_id: accountId }, { account_id: { $exists: false } }]);
    return query(mapping);
  });
  t.mock.method(UserModel, 'findOne', (filter: any) => {
    assert.deepEqual(filter, { _id: userId, account_id: accountId }); return query({ _id: userId });
  });
  t.mock.method(AssetModel, 'findOne', (filter: any) => {
    assert.deepEqual(filter, { _id: assetId, account_id: accountId, visible: true });
    return query({ _id: assetId, asset_name: 'Motor' });
  });
  t.mock.method(MapUserAssetLocationModel, 'findOneAndUpdate', (filter: any, update: any, options: any) => {
    assert.deepEqual(filter, { _id: mappingId, userId, assetId, $or: [{ account_id: accountId }, { account_id: { $exists: false } }] });
    assert.deepEqual(update, { $set: { 'notifications.push.critical': true } });
    assert.deepEqual(options, { new: true, runValidators: true, upsert: false });
    return query({ ...mapping, notifications: { ...mapping.notifications, push: { critical: true } } });
  });
  const result = await patchUserNotifications(accountId, mappingId, { notifications: { push: { critical: true } } });
  assert.equal(result.notifications.email.alert, true);
  assert.equal(result.notifications.push.critical, true);
  assert.equal(Object.hasOwn(result, 'sendMail'), false);
});

test('PATCH rejects tenant conflicts, missing users, invisible assets, and location-only mappings before any write', async t => {
  const { patchUserNotifications } = require('./userNotifications');
  let mapping: any = { _id: mappingId, userId, assetId };
  let user: any = { _id: userId };
  let asset: any = { _id: assetId, asset_name: 'Motor' };
  t.mock.method(MapUserAssetLocationModel, 'findOne', () => query(mapping));
  t.mock.method(UserModel, 'findOne', () => query(user));
  t.mock.method(AssetModel, 'findOne', () => query(asset));
  t.mock.method(MapUserAssetLocationModel, 'findOneAndUpdate', () => { assert.fail('must not write an inaccessible mapping'); });
  const patch = () => patchUserNotifications(accountId, mappingId, { notifications: { sms: { alert: true } } });
  mapping.account_id = foreignId;
  await assert.rejects(patch(), (e: any) => e.status === 404);
  delete mapping.account_id;
  user = null;
  await assert.rejects(patch(), (e: any) => e.status === 404);
  user = { _id: userId }; asset = null;
  await assert.rejects(patch(), (e: any) => e.status === 404);
  delete mapping.assetId;
  await assert.rejects(patch(), (e: any) => e.status === 404);
});

test('channel saves across assignments preserve other channels and legacy mail values', async t => {
  const { patchUserNotifications } = require('./userNotifications');
  const secondMappingId = '64a000000000000000000007';
  const mappings = new Map([mappingId, secondMappingId].map(id => [id, {
    _id: id, userId, assetId, account_id: accountId,
    sendMail: true, alert: true, danger: false, critical: true,
    notifications: { email: { alert: true, danger: false, critical: false }, push: { alert: true, danger: true, critical: true } }
  }]));
  t.mock.method(MapUserAssetLocationModel, 'findOne', (filter: any) => query(mappings.get(filter._id)));
  t.mock.method(UserModel, 'findOne', () => query({ _id: userId }));
  t.mock.method(AssetModel, 'findOne', () => query({ _id: assetId, asset_name: 'Motor' }));
  t.mock.method(MapUserAssetLocationModel, 'findOneAndUpdate', (filter: any, update: any) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.assetId, assetId);
    assert.deepEqual(filter.$or, [{ account_id: accountId }, { account_id: { $exists: false } }]);
    assert.deepEqual(update, { $set: {
      'notifications.email.alert': false, 'notifications.email.danger': true, 'notifications.email.critical': true
    } });
    const mapping = mappings.get(filter._id)!;
    mapping.notifications.email = { alert: false, danger: true, critical: true };
    return query(mapping);
  });
  for (const id of [mappingId, secondMappingId]) {
    const saved = await patchUserNotifications(accountId, id, { notifications: { email: { alert: false, danger: true, critical: true } } });
    assert.deepEqual(saved.notifications.email, { alert: false, danger: true, critical: true });
    assert.deepEqual(saved.notifications.push, { alert: true, danger: true, critical: true });
    assert.equal(mappings.get(id)!.sendMail, true);
    assert.equal(mappings.get(id)!.alert, true);
    assert.equal(mappings.get(id)!.danger, false);
    assert.equal(mappings.get(id)!.critical, true);
  }
});

test('permission guard requires authenticated tenant and capped menu view/edit including admin panel', () => {
  const { notificationPermission } = require('./userNotifications');
  const req: any = { user: { account_id: accountId }, roleMenu: {
    master_admin_panel: { view: true }, asset_mail: { view: true, edit: false }
  } };
  let error: any;
  notificationPermission('view')(req, {} as any, (e: any) => { error = e; });
  assert.equal(error, undefined);
  notificationPermission('edit')(req, {} as any, (e: any) => { error = e; });
  assert.equal((error as any).status, 403);
  req.roleMenu.asset_mail.edit = true;
  req.roleMenu.master_admin_panel.view = false;
  notificationPermission('edit')(req, {} as any, (e: any) => { error = e; });
  assert.equal((error as any).status, 403);
  req.user = {};
  notificationPermission('view')(req, {} as any, (e: any) => { error = e; });
  assert.equal((error as any).status, 401);
});

test('invalid target IDs and invalid patches fail before accessing persistence', async t => {
  const { getUserNotifications, patchUserNotifications } = require('./userNotifications');
  t.mock.method(UserModel, 'findOne', () => { assert.fail('must validate before querying users'); });
  t.mock.method(MapUserAssetLocationModel, 'findOne', () => { assert.fail('must validate before querying mappings'); });
  for (const id of [undefined, '', 'invalid', [userId], { $ne: null }]) {
    await assert.rejects(getUserNotifications(accountId, id), (e: any) => e.status === 400);
    await assert.rejects(patchUserNotifications(accountId, id, { notifications: { email: { alert: true } } }), (e: any) => e.status === 400);
  }
  await assert.rejects(patchUserNotifications(accountId, mappingId, { notifications: { email: { alert: 'true' } } }),
    (e: any) => e.status === 400);
});

test('GET drops explicit conflicting tenant rows and assets outside the visible tenant set', async t => {
  const { getUserNotifications } = require('./userNotifications');
  t.mock.method(UserModel, 'findOne', () => query({ _id: userId }));
  t.mock.method(AssetModel, 'find', () => query([{ _id: assetId, asset_name: 'Motor' }]));
  t.mock.method(MapUserAssetLocationModel, 'find', () => query([
    { _id: mappingId, userId, assetId, account_id: foreignId },
    { _id: mappingId, userId, assetId: foreignId },
    { _id: mappingId, userId, locationId: foreignId },
    { _id: mappingId, userId, assetId, account_id: null }
  ]));
  assert.deepEqual(await getUserNotifications(accountId, userId), { data: [] });
});

test('notification routes register protected GET and PATCH handlers', () => {
  const express = require('express');
  const { userNotificationRoutes } = require('./userNotifications');
  const router = express.Router();
  userNotificationRoutes(router);
  const routes = router.stack.map((layer: any) => layer.route);
  assert.equal(routes[0].path, '/user-notifications');
  assert.equal(routes[0].methods.get, true);
  assert.equal(routes[1].path, '/user-notifications/:mappingId');
  assert.equal(routes[1].methods.patch, true);
  for (const route of routes) {
    assert.equal(route.stack.length, 2);
    let error: any;
    route.stack[0].handle({ user: { account_id: accountId }, roleMenu: {} }, {}, (e: any) => { error = e; });
    assert.equal(error.status, 403);
  }
});
