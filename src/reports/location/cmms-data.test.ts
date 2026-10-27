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
});
