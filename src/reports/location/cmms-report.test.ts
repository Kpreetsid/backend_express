import test from 'node:test';
import assert from 'node:assert/strict';
import { cmmsMetrics, cmmsPeriod, cmmsSpareRows, cmmsSummaryResponse, cmmsSpareResponse, reportDate, CmmsOrder, CmmsSensorReport } from './cmms-report';

const now = new Date('2026-10-26T08:00:00.000Z');
const period = cmmsPeriod({ from_date: '2026-10-19', to_date: '2026-10-25' }, now);
const org = '68aff3fb2517f347390f5f01';
const assetIds = new Set(['train', 'motor']);
const metrics = (orders: CmmsOrder[], reports: CmmsSensorReport[] = []) =>
  cmmsMetrics(orders, [], reports, assetIds, org, period, now);

test('summary response defaults unknown numbers to zero and dates to N/A without changing source quality', () => {
  const raw = metrics([{ _id: 'wo', start_date: '2026-10-21T12:00:00Z', nature_of_work: 'Breakdown', actual_time: 2,
    parts: [{ actualQuantity: 2 }] }]);
  const result = cmmsSummaryResponse(raw);
  assert.equal(raw.downtime_h, null);
  assert.equal(raw.spare_cost_inr, null);
  for (const field of ['downtime_h', 'spare_cost_inr', 'labor_cost_inr', 'total_cost_inr', 'peak_endpoint_rms_mm_s'] as const) {
    assert.equal(result[field], 0);
    assert.equal(typeof result[field], 'number');
  }
  assert.equal(result.planner_wos, 0);
  assert.equal(result.spare_qty_used, 2);
  assert.equal(result.oldest_sensor_reading, 'N/A');
  assert.equal(result.data_quality_flag, 'NO_DATA');
  const known = cmmsSummaryResponse(metrics([], [{ createdOn: now, assetId: 'motor', endpointRMSData: [{
    velocity: { Axial: { rms: 1.81, timestamp: '2026-10-26T06:00:00Z' } }
  }] }]));
  assert.equal(known.peak_endpoint_rms_mm_s, 1.81);
  assert.equal(known.oldest_sensor_reading, '26/10/2026 11:30:00');
});

test('spare response defaults missing fields by type and preserves known text and numbers', () => {
  const [raw] = cmmsSpareRows([{ _id: 'part', part_name: 'Bearing', part_number: 'BRG',
    quantity: 1, min_quantity: 3, cost: 1250, lead_time_days: 0 }], [], new Map());
  const row = cmmsSpareResponse({ ...raw, asset_id: null });
  assert.equal(row.asset_id, 'N/A');
  assert.equal(row.location_name, 'N/A');
  assert.equal(row.supplier, 'N/A');
  assert.equal(row.spare_part_name, 'Bearing');
  assert.equal(row.unit_cost_inr, 1250);
  assert.equal(row.lead_time_days, 0);
  for (const field of ['asset_name', 'classification', 'max_stock', 'reorder_to_max_qty', 'replenishment_inr', 'responsible_group']) {
    assert.equal(field in row, false);
  }
  assert.equal(row.stock_status, 'LOW');
  assert.equal(raw.max_stock, null);
});

test('planner requires exact Preventive creation source; completed and open include all sources and dates', () => {
  const orders: CmmsOrder[] = [
    { _id: 'pm1', createdFrom: 'Preventive', end_date: '2026-10-20T00:00:00Z', status: 'Completed' },
    { _id: 'pm2', type: 'Preventive Maintenance', end_date: '2026-10-21T00:00:00Z', status: 'Completed' },
    { _id: 'pm3', type: 'PM', end_date: '2026-10-22T00:00:00Z', status: 'Open' },
    { _id: 'rejected', createdFrom: 'Preventive', type: 'PM', end_date: '2026-10-22T00:00:00Z', status: 'Rejected' },
    { _id: 'future', type: 'General', end_date: '2026-10-29T00:00:00Z', status: 'In-Progress' },
    { _id: 'old-completed', type: 'General', start_date: '2026-01-01', status: 'Completed' },
    { _id: 'nature', type: 'General', nature_of_work: 'Preventive', status: 'On-Hold' },
    { _id: 'blocked', status: 'Blocked' },
    { _id: 'parts', status: 'Waiting-on-Parts' },
    { _id: 'permit', status: 'Waiting-on-Permit' },
    { _id: 'planner-future', createdFrom: 'Preventive', type: 'General', end_date: '2027-01-01', status: 'Open' },
    { _id: 'different-case', createdFrom: 'preventive', status: 'Open' }
  ];
  const result = metrics(orders);
  assert.equal(result.planner_wos, 2);
  assert.equal(result.completed_wos, 3);
  assert.equal(result.open_wos, 7);
  assert.equal(result.overdue_wos, 1);
  for (const field of ['pm_planned', 'pm_completed', 'pm_overdue', 'open_overdue_wos']) {
    assert.equal(field in result, false);
  }
  const differentPeriod = cmmsMetrics(orders, [], [], assetIds, org,
    cmmsPeriod({ from_date: '2025-01-01', to_date: '2025-01-02' }, now), now);
  assert.equal(differentPeriod.planner_wos, 2);
  assert.equal(differentPeriod.completed_wos, 3);
  assert.equal(differentPeriod.open_wos, 7);
  assert.equal(differentPeriod.overdue_wos, 1);
});

test('open and overdue partition pending work at snapshot time without double counting', () => {
  const orders: CmmsOrder[] = [
    { _id: 'past', status: 'Open', end_date: new Date(now.getTime() - 1) },
    { _id: 'blocked', status: 'Blocked', end_date: '2020-01-01' },
    { _id: 'exact', status: 'In-Progress', end_date: now },
    { _id: 'future', status: 'On-Hold', end_date: '2027-01-01' },
    { _id: 'missing', status: 'Waiting-on-Parts' },
    { _id: 'invalid', status: 'Waiting-on-Permit', end_date: 'invalid' },
    { _id: 'completed', status: 'Completed', end_date: '2020-01-01' },
    { _id: 'rejected', status: 'Rejected', end_date: '2020-01-01' }
  ];
  const result = metrics(orders);
  assert.equal(result.open_wos, 4);
  assert.equal(result.overdue_wos, 2);
  assert.equal(result.completed_wos, 1);
  assert.equal(result.open_wos + result.overdue_wos, 6);
  assert.equal('open_overdue_wos' in result, false);
  assert.equal(metrics([]).open_wos, 0);
  assert.equal(metrics([]).overdue_wos, 0);
});

test('breakdown requires exact nature_of_work, excludes rejected work and ignores report dates', () => {
  const orders: CmmsOrder[] = [
    { _id: 'old', nature_of_work: 'Breakdown', type: 'General', status: 'Completed', start_date: '2020-01-01' },
    { _id: 'future', nature_of_work: 'Breakdown', createdFrom: 'Preventive', status: 'Open', start_date: '2027-01-01' },
    { _id: 'rejected', nature_of_work: 'Breakdown', status: 'Rejected' },
    { _id: 'type-only', type: 'Breakdown', nature_of_work: 'General', status: 'Open' },
    { _id: 'different-case', nature_of_work: 'breakdown', status: 'Open' },
    { _id: 'prefix', nature_of_work: 'Breakdown Maintenance', status: 'Open' }
  ];
  assert.equal(metrics(orders).breakdown_wos, 2);
  assert.equal(metrics([]).breakdown_wos, 0);
});

test('actual consumption uses unit cost and net issued quantities, never planned quantities', () => {
  const orders: CmmsOrder[] = [{ _id: 'wo', start_date: '2026-10-21T12:00:00Z', parts: [
    { actualQuantity: 2, cost: 1250, currency: 'INR' },
    { issuedQuantity: 4, returnedQuantity: 1, cost: 320, currency: 'INR' },
    { cost: 9000 }, { actualQuantity: 0, issuedQuantity: 10, cost: 500 }
  ] }, { _id: 'old', start_date: '2026-09-21T12:00:00Z', parts: [{ actualQuantity: 100, cost: 500 }] }];
  const result = metrics(orders);
  assert.equal(result.spare_qty_used, 5);
  assert.equal(result.spare_cost_inr, 3460);
  assert.equal(result.total_cost_inr, 3460);
});

test('missing labor costs, downtime, part price and foreign currency are not reported as known zero costs', () => {
  const result = metrics([{ _id: 'wo', start_date: '2026-10-21T12:00:00Z', nature_of_work: 'Breakdown', actual_time: 6.3,
    parts: [{ actualQuantity: 2, cost: 100, currency: 'USD' }], labor_entries: [{ hours: 2 }] }]);
  assert.equal(result.planner_wos, 0);
  assert.equal(result.downtime_h, null);
  assert.equal(result.labor_cost_inr, null);
  assert.equal(result.spare_cost_inr, null);
  assert.equal(result.total_cost_inr, null);
  assert.equal(metrics([{ _id: 'wo', start_date: '2026-10-21T12:00:00Z', parts: [{ actualQuantity: 2 }] }]).spare_cost_inr, null);
});

test('historical peak differs from newest reading and sensor age uses latest saved snapshot per endpoint axis', () => {
  const reports: CmmsSensorReport[] = [
    { createdOn: '2026-10-20T00:00:00Z', endpointRMSData: [{ asset_id: 'motor', composite_id: 'sensor',
      velocity: { Axial: { rms: 16.75, timestamp: '2026-10-19T00:00:00Z' } } }] },
    { createdOn: '2026-10-26T07:00:00Z', endpointRMSData: [{ asset_id: 'motor', composite_id: 'sensor',
      velocity: { Axial: { rms: '1.17', timestamp: '2026-10-26T06:00:00Z' } } }] },
    { createdOn: '2026-10-26T07:00:00Z', endpointRMSData: [{ asset_id: 'motor', org_id: 'different-org', composite_id: 'bad',
      velocity: { Axial: { rms: 999, timestamp: '2026-10-26T06:00:00Z' } } }] }
  ];
  const result = metrics([], reports);
  assert.equal(result.peak_endpoint_rms_mm_s, 16.75);
  assert.equal(result.oldest_sensor_reading, '26/10/2026 11:30:00');
  assert.equal(result.data_quality_flag, 'RECENT');
});

test('a stale component makes the train stale and readings from other assets do not leak into it', () => {
  const reports: CmmsSensorReport[] = [{ createdOn: now, endpointRMSData: [
    { asset_id: 'train', composite_id: 'one', velocity: { Axial: { rms: 1, timestamp: now.getTime() / 1000 } } },
    { asset_id: 'motor', composite_id: 'two', velocity: { Horizontal: { rms: 2, timestamp: '2026-10-20T06:00:00Z' } } },
    { asset_id: 'unrelated', composite_id: 'three', velocity: { Vertical: { rms: 99, timestamp: '2026-01-01T00:00:00Z' } } }
  ] }];
  const result = metrics([], reports);
  assert.equal(result.data_quality_flag, 'STALE');
  assert.equal(result.peak_endpoint_rms_mm_s, 2);
  assert.equal(result.oldest_sensor_reading, '20/10/2026 11:30:00');
});

test('missing, zero, future and absent velocity data produce explicit quality flags', () => {
  assert.equal(metrics([]).data_quality_flag, 'NO_DATA');
  assert.equal(metrics([]).peak_endpoint_rms_mm_s, null);
  assert.equal(metrics([]).oldest_sensor_reading, null);
  const snapshot = (reading: { rms?: unknown; timestamp?: unknown }): CmmsSensorReport[] =>
    [{ createdOn: now, assetId: 'motor', endpointRMSData: [{ composite_id: 'zero', velocity: { Axial: reading } }] }];
  assert.equal(metrics([], snapshot({ rms: 0, timestamp: now })).data_quality_flag, 'RECENT');
  assert.equal(metrics([], snapshot({ rms: null, timestamp: now })).data_quality_flag, 'MISSING');
  assert.equal(metrics([], snapshot({ rms: 1 })).data_quality_flag, 'MISSING');
  assert.equal(metrics([], snapshot({ rms: 1, timestamp: '2027-01-01T00:00:00Z' })).data_quality_flag, 'NO_DATA');
});

test('sensor timestamp formatting uses IST date rollover and padded 24-hour components', () => {
  const result = metrics([], [{ createdOn: now, assetId: 'motor', endpointRMSData: [{
    velocity: { Axial: { rms: 1, timestamp: '2025-12-31T18:35:09Z' } }
  }] }]);
  assert.equal(result.oldest_sensor_reading, '01/01/2026 00:05:09');
  assert.equal(result.data_quality_flag, 'STALE');
});

test('stock rows map low/out of stock/OK, supplier and criticality without inventing maximum stock', () => {
  const rows = cmmsSpareRows([
    { _id: 'one', part_name: 'Bearing', part_number: 'BRG', part_type: 'critical', location_id: 'loc', quantity: 1, min_quantity: 3, cost: 1250, preferred_vendor: 'Supplier A', lead_time_days: 6 },
    { _id: 'two', part_name: 'Seal', part_number: 'SEAL', part_type: 'critical', location_id: 'loc', quantity: 0, min_quantity: 2, cost: 1650 },
    { _id: 'three', part_name: 'Grease', part_number: 'GRS', part_type: 'general', location_id: 'loc', quantity: 5, min_quantity: 4, cost: 320 }
  ], [{ _id: 'critical', name: 'Critical' }, { _id: 'general', name: 'General' }], new Map([['loc', 'Dadar 201']]));
  assert.deepEqual(rows.map(row => row.stock_status), ['LOW', 'OUT OF STOCK', 'OK']);
  assert.equal(rows[0].location_name, 'Dadar 201');
  assert.equal('asset_location' in rows[0], false);
  assert.equal(rows[0].max_stock, null);
  assert.equal(rows[0].replenishment_inr, null);
  assert.equal(rows[0].reorder_to_max_qty, null);
  assert.equal(rows[2].replenishment_inr, 0);
  assert.equal(cmmsMetrics([], rows, [], new Set(), org, period, now).low_critical_spares, 2);
});

test('low stock with unknown criticality is not treated as zero critical shortages', () => {
  const rows = cmmsSpareRows([{ _id: 'one', part_name: 'Bearing', part_number: 'BRG', quantity: 1, min_quantity: 3, cost: 100 }], [], new Map());
  assert.equal(rows[0].classification, null);
  assert.equal(cmmsMetrics([], rows, [], new Set(), org, period, now).low_critical_spares, null);
});

test('defaults to Monday IST week to now and validates explicit date ranges and freshness threshold', () => {
  const monday = cmmsPeriod({}, now);
  assert.equal(monday.from.toISOString(), '2026-10-25T18:30:00.000Z');
  assert.equal(monday.to.toISOString(), now.toISOString());
  assert.equal(period.from.toISOString(), '2026-10-18T18:30:00.000Z');
  assert.equal(period.to.toISOString(), '2026-10-25T18:29:59.999Z');
  for (const input of [{ from_date: 'bad' }, { from_date: '2026-02-30' }, { to_date: {} },
    { from_date: '2026-10-26', to_date: '2026-10-25' }, { stale_after_hours: 0 }, { stale_after_hours: '24' }]) {
    assert.throws(() => cmmsPeriod(input, now), { status: 400 });
  }
  assert.equal(reportDate('1793001600')?.toISOString(), new Date(1793001600000).toISOString());
});

test('recorded labor entry totals are summed once and included in total cost', () => {
  const result = metrics([{ _id: 'wo', start_date: '2026-10-21', actual_time: 33,
    labor_entries: [{ hours: 10, labor_cost: 2500 }, { hours: 2, labor_cost: 125.50 }],
    parts: [{ actualQuantity: 2, cost: 100, currency: 'INR' }] }]);
  assert.equal(result.labor_cost_inr, 2625.50);
  assert.equal(result.total_cost_inr, 2825.50);
  assert.equal(cmmsSummaryResponse(result).labor_cost_inr, 2625.50);
});

test('recorded labor costs survive unpriced labor elsewhere in the cohort', () => {
  const result = metrics([
    { _id: 'priced', start_date: '2026-10-21', labor_entries: [{ hours: 10, labor_cost: 2500 }, { hours: 1 }] },
    { _id: 'unpriced', start_date: '2026-10-21', actual_time: 2, labor_entries: [{ hours: 2, labor_cost: null }] }
  ]);
  assert.equal(result.labor_cost_inr, 2500);
  assert.equal(result.total_cost_inr, 2500);
});

test('labor costs honor the report cohort, creation-date fallback and rejected status', () => {
  const result = metrics([
    { _id: 'in-period', start_date: '2026-10-21', labor_entries: [{ hours: 2, labor_cost: 100 }] },
    { _id: 'creation-fallback', createdAt: '2026-10-22', labor_entries: [{ hours: 2, labor_cost: 200 }] },
    { _id: 'old', start_date: '2026-10-01', labor_entries: [{ hours: 2, labor_cost: 1000 }] },
    { _id: 'future', start_date: '2026-11-01', labor_entries: [{ hours: 2, labor_cost: 1000 }] },
    { _id: 'rejected', start_date: '2026-10-21', status: 'Rejected', labor_entries: [{ hours: 2, labor_cost: 1000 }] }
  ]);
  assert.equal(result.labor_cost_inr, 300);
  assert.equal(result.total_cost_inr, 300);
});

test('explicit zero labor cost is recorded, invalid amounts are ignored and sums round to cents', () => {
  const zero = metrics([{ _id: 'wo', start_date: '2026-10-21', actual_time: 10,
    labor_entries: [{ hours: 10, labor_cost: 0 }] }]);
  assert.equal(zero.labor_cost_inr, 0);
  assert.equal(zero.total_cost_inr, 0);
  const result = metrics([{ _id: 'wo', start_date: '2026-10-21', labor_entries: [
    { hours: 1, labor_cost: 0.1 }, { hours: 1, labor_cost: 0.2 },
    { hours: 1, labor_cost: -1 }, { hours: 1, labor_cost: NaN }, { hours: 1, labor_cost: Infinity }
  ] }]);
  assert.equal(result.labor_cost_inr, 0.3);
  assert.equal(result.total_cost_inr, 0.3);
});
