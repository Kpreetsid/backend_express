import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCmmsLocationData, cmmsDataService, validateCmmsRequest } from './cmms-data.service';
import { LocationModel } from '../../modules/locations/models/location.model';
import { AssetModel } from '../../modules/assets/models/asset.model';
import { getCmmsLocationData } from './cmms-data.controller';
import { WorkOrderModel } from '../../modules/work-orders/models/workOrder.model';
import { PartsModel } from '../../modules/inventory/models/part.model';
import { PartsTypeModel } from '../../modules/inventory/models/parts-types.model';
import { ReportAssetModel } from '../../modules/reports/models/assetReport.model';

const org = '68aff3fb2517f347390f5f01';
const root = '68aff4762517f347390f5f04';
const locations = [
  { _id: root, location_name: 'Plant', top_level: true },
  { _id: 'child', location_name: 'Line', parent_id: root },
  { _id: 'grandchild', location_name: 'Room', parent_id: 'child' },
  { _id: 'other', location_name: 'Other plant', top_level: true }
];
const assets = [
  { _id: 'train', asset_name: 'Train', top_level: true, locationId: root },
  { _id: 'motor', asset_name: 'Motor', parent_id: 'train', locationId: 'child' },
  { _id: 'bearing', asset_name: 'Bearing', parent_id: 'motor', locationId: 'grandchild' },
  { _id: 'pump', asset_name: 'Pump', top_level: true, locationId: 'grandchild' },
  { _id: 'impeller', asset_name: 'Impeller', top_level_asset_id: 'pump', locationId: 'grandchild' },
  { _id: 'outside', asset_name: 'Outside', top_level: true, locationId: 'other' }
];

test('includes assets at root and descendant locations and groups nested components under their root', () => {
  const [data] = buildCmmsLocationData([root], locations, assets);
  assert.deepEqual(data.child_location_ids, ['child', 'grandchild']);
  assert.deepEqual(data.asset_data.map(asset => asset._id), ['train', 'pump']);
  assert.deepEqual(data.asset_data[0].child_assets.map(asset => asset._id), ['motor', 'bearing']);
  assert.equal(data.asset_data[0].child_assets[1].location_name, 'Room');
  assert.deepEqual(data.asset_data[1].child_assets.map(asset => asset._id), ['impeller']);
});

test('keeps multiple selected location trees separate and preserves empty locations', () => {
  const data = buildCmmsLocationData([root, 'other'], locations, assets.slice(0, -1));
  assert.equal(data.length, 2);
  assert.deepEqual(data[1].asset_data, []);
});

test('terminates on cyclic locations and asset parents', () => {
  const cyclicLocations = locations.map(location => location._id === root ? { ...location, parent_id: 'grandchild' } : location);
  const cyclicAssets = [...assets,
    { _id: 'a', asset_name: 'A', parent_id: 'b', locationId: root },
    { _id: 'b', asset_name: 'B', parent_id: 'a', locationId: root }];
  assert.equal(buildCmmsLocationData([root], cyclicLocations, cyclicAssets)[0].asset_data.length, 2);
});

test('validates tenant identity, strict ObjectIds and duplicate requested locations', () => {
  assert.deepEqual(validateCmmsRequest({ org_id: org.toUpperCase(), location_ids: [root, root.toUpperCase()] }, org),
    { org_id: org, location_ids: [root] });
  for (const location_ids of [[], null, root, [null], ['bad'], [{ $ne: null }]]) {
    assert.throws(() => validateCmmsRequest({ org_id: org, location_ids }, org), { status: 400 });
  }
  assert.throws(() => validateCmmsRequest({ org_id: root, location_ids: [root] }, org), { status: 403 });
  assert.throws(() => validateCmmsRequest({ org_id: org, location_ids: [root] }, undefined), { status: 401 });
  assert.throws(() => buildCmmsLocationData(['missing'], locations, assets), { status: 404 });
  assert.throws(() => buildCmmsLocationData(['child'], locations, assets), { status: 400 });
});

test('all database reads enforce tenant and visibility and invalid requests never query', async t => {
  let reads = 0;
  for (const [model, records] of [[LocationModel, locations], [AssetModel, assets]] as const) {
    t.mock.method(model, 'find', ((filter: any) => {
      reads++;
      assert.equal(String(filter.account_id), org);
      assert.equal(filter.visible, true);
      const query: any = { select: () => query, sort: () => query, lean: async () => records };
      return query;
    }) as any);
  }
  for (const model of [WorkOrderModel, PartsModel, PartsTypeModel, ReportAssetModel]) {
    t.mock.method(model, 'find', ((filter: any) => {
      reads++;
      assert.equal(String(filter.account_id || filter.accountId), org);
      assert.equal(filter.visible, true);
      const query: any = { select: () => query, sort: () => query, lean: async () => [] };
      return query;
    }) as any);
  }
  await assert.rejects(cmmsDataService.getData({ org_id: root, location_ids: [root] }, org), { status: 403 });
  assert.equal(reads, 0);
  const data = await cmmsDataService.getData({ org_id: org, location_ids: [root] }, org);
  assert.equal(reads, 6);
  assert.equal(data.locations[0].asset_data.length, 2);
  assert.equal(data.cmms_summary.length, 2);
  assert.equal(data.week_total_snapshot.pm_planned, 0);
});

test('controller returns the standard envelope and forwards validation errors', async t => {
  const data = [{ location_id: root, location_name: 'Plant', child_location_ids: [], asset_data: [] }];
  const error = Object.assign(new Error('Invalid payload'), { status: 400 });
  let shouldFail = false;
  t.mock.method(cmmsDataService, 'getData', async (body: unknown, accountId: unknown) => {
    if (shouldFail) throw error;
    assert.equal(accountId, org);
    assert.deepEqual(body, { org_id: org, location_ids: [root] });
    return data;
  });
  const response: any = { status(code: number) { assert.equal(code, 200); return this; },
    json(value: unknown) { assert.deepEqual(value, { status: true, message: 'Data fetched successfully', data }); } };
  await getCmmsLocationData({ body: { org_id: org, location_ids: [root] }, user: { account_id: org } } as any,
    response, (error?: unknown) => { throw error; });
  shouldFail = true;
  let forwarded: unknown;
  await getCmmsLocationData({} as any, response, (value?: unknown) => { forwarded = value; });
  assert.equal(forwarded, error);
});

test('child WO consumption and RMS roll up into the parent asset and deduplicated global totals', async t => {
  const current = new Date().toISOString();
  const orders = [{ _id: 'work', wo_asset_id: 'motor', wo_location_id: 'child', start_date: current,
    end_date: current, createdFrom: 'Preventive', status: 'Completed', parts: [{ part_id: 'bearing-part', actualQuantity: 2, cost: 1250, currency: 'INR' }] }];
  const parts = [{ _id: 'bearing-part', part_name: 'Bearing', part_number: 'BRG', part_type: 'critical', location_id: 'child', quantity: 1, min_quantity: 3, cost: 1250 }];
  const snapshots = [{ top_level_asset_id: 'train', createdOn: current,
    endpointRMSData: [{ asset_id: 'motor', org_id: org, composite_id: 'sensor', velocity: { Axial: { rms: 16.75, timestamp: current } } }] }];
  for (const [model, records] of [[LocationModel, locations], [AssetModel, assets], [WorkOrderModel, orders],
    [PartsModel, parts], [PartsTypeModel, [{ _id: 'critical', name: 'Critical' }]], [ReportAssetModel, snapshots]] as const) {
    t.mock.method(model, 'find', (() => {
      const query: any = { select: () => query, sort: () => query, lean: async () => records };
      return query;
    }) as any);
  }
  const result = await cmmsDataService.getData({ org_id: org, location_ids: [root, root] }, org);
  assert.equal(result.locations.length, 1);
  const train = result.locations[0].asset_data[0];
  assert.equal(train.summary.pm_planned, 1);
  assert.equal(train.summary.spare_qty_used, 2);
  assert.equal(train.summary.spare_cost_inr, 2500);
  assert.equal(train.summary.peak_endpoint_rms_mm_s, 16.75);
  assert.equal(result.locations[0].asset_data[1].summary.spare_qty_used, 0);
  assert.equal(result.week_total_snapshot.spare_qty_used, 2);
  assert.equal(result.week_total_snapshot.low_critical_spares, 1);
  assert.equal(result.critical_spares_stock_replenishment.length, 1);
  assert.equal(result.critical_spares_stock_replenishment[0].asset_id, 'motor');
  assert.equal(result.critical_spares_stock_replenishment[0].asset_name, 'Motor');
  assert.equal(result.critical_spares_stock_replenishment[0].location_name, 'Line');
  assert.equal(train.summary.oldest_sensor_reading, result.cmms_summary[0].oldest_sensor_reading);
  assert.equal(train.summary.oldest_sensor_reading, result.week_total_snapshot.oldest_sensor_reading);
});

test('flat summary excludes location-only rows and uses each asset actual location', async t => {
  const orders = [{ _id: 'location-work', wo_location_id: root, status: 'Open', end_date: '2020-01-01T00:00:00Z' }];
  for (const [model, records] of [[LocationModel, locations], [AssetModel, assets], [WorkOrderModel, orders],
    [PartsModel, []], [PartsTypeModel, []], [ReportAssetModel, []]] as const) {
    t.mock.method(model, 'find', (() => {
      const query: any = { select: () => query, sort: () => query, lean: async () => records };
      return query;
    }) as any);
  }
  const result = await cmmsDataService.getData({ org_id: org, location_ids: [root] }, org);
  assert.equal(result.cmms_summary.length, 2);
  assert.deepEqual(result.cmms_summary.map(row => [row.asset_id, row.asset_name, row.location_id, row.location_name]),
    [['train', 'Train', root, 'Plant'], ['pump', 'Pump', 'grandchild', 'Room']]);
  assert.ok(result.cmms_summary.every(row => !('asset_location' in row) && row.open_overdue_wos === 0));
  assert.equal(result.locations[0].summary.open_overdue_wos, 1);
  assert.equal(result.week_total_snapshot.open_overdue_wos, 1);
  assert.equal(result.week_total_snapshot.overdue_wos, 1);
});

test('shared spare associations are deduplicated per asset and never multiply stock totals', async t => {
  const orders = [
    { _id: 'one', wo_asset_id: 'motor', parts: [{ part_id: 'shared' }, { part_id: 'shared' }] },
    { _id: 'two', wo_asset_id: 'motor', parts: [{ part_id: 'shared' }] },
    { _id: 'three', wo_asset_id: 'pump', parts: [{ part_id: 'shared' }] },
    { _id: 'four', wo_location_id: root, parts: [{ part_id: 'unlinked' }] },
    { _id: 'outside-work', wo_asset_id: 'outside', parts: [{ part_id: 'unlinked' }] }
  ];
  const parts = ['shared', 'unlinked'].map(partId => ({ _id: partId, part_name: partId, part_number: partId,
    location_id: root, part_type: 'critical', quantity: 1, min_quantity: 2, cost: 10 }));
  for (const [model, records] of [[LocationModel, locations], [AssetModel, assets], [WorkOrderModel, orders],
    [PartsModel, parts], [PartsTypeModel, [{ _id: 'critical', name: 'Critical' }]], [ReportAssetModel, []]] as const) {
    t.mock.method(model, 'find', (() => {
      const query: any = { select: () => query, sort: () => query, lean: async () => records };
      return query;
    }) as any);
  }
  const result = await cmmsDataService.getData({ org_id: org, location_ids: [root] }, org);
  assert.deepEqual(result.critical_spares_stock_replenishment.map(row => [row.part_id, row.asset_id, row.asset_name]),
    [['shared', 'motor', 'Motor'], ['shared', 'pump', 'Pump'], ['unlinked', null, null]]);
  assert.ok(result.critical_spares_stock_replenishment.every(row => row.location_name === 'Plant' && !('asset_location' in row)));
  assert.equal(result.week_total_snapshot.low_critical_spares, 2);
  assert.equal(result.locations[0].summary.low_critical_spares, 2);
});

test('an empty location returns no synthetic asset summary row', async t => {
  for (const [model, records] of [[LocationModel, locations], [AssetModel, []],
    [WorkOrderModel, [{ _id: 'location-work', wo_location_id: root, status: 'Open' }]],
    [PartsModel, []], [PartsTypeModel, []], [ReportAssetModel, []]] as const) {
    t.mock.method(model, 'find', (() => {
      const query: any = { select: () => query, sort: () => query, lean: async () => records };
      return query;
    }) as any);
  }
  const result = await cmmsDataService.getData({ org_id: org, location_ids: [root] }, org);
  assert.deepEqual(result.cmms_summary, []);
  assert.equal(result.locations[0].summary.open_overdue_wos, 1);
  assert.equal(result.week_total_snapshot.open_overdue_wos, 1);
});
