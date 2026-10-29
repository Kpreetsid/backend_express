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
  const raw = metrics([{ _id: 'wo', start_date: '2026-10-21T12:00:00Z', type: 'Breakdown', actual_time: 2,
    parts: [{ actualQuantity: 2 }] }]);
  const result = cmmsSummaryResponse(raw);
  assert.equal(raw.downtime_h, null);
  assert.equal(raw.spare_cost_inr, null);
  for (const field of ['downtime_h', 'spare_cost_inr', 'labor_cost_inr', 'total_cost_inr', 'peak_endpoint_rms_mm_s'] as const) {
    assert.equal(result[field], 0);
    assert.equal(typeof result[field], 'number');
  }
  assert.equal(result.breakdown_wos, 1);
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
  const row = cmmsSpareResponse({ ...raw, asset_id: null, asset_name: null });
  assert.equal(row.asset_id, 'N/A');
  assert.equal(row.asset_name, 'N/A');
  assert.equal(row.location_name, 'N/A');
  assert.equal(row.supplier, 'N/A');
  assert.equal(row.classification, 'N/A');
  assert.equal(row.responsible_group, 'N/A');
  assert.equal(row.spare_part_name, 'Bearing');
  assert.equal(row.unit_cost_inr, 1250);
  assert.equal(row.lead_time_days, 0);
  assert.equal(row.max_stock, 0);
  assert.equal(row.reorder_to_max_qty, 0);
  assert.equal(row.replenishment_inr, 0);
  assert.equal(row.stock_status, 'LOW');
  assert.equal(raw.max_stock, null);
});

test('PM cohort counts due work and excludes rejected work; open count includes future-due work once', () => {
  const orders: CmmsOrder[] = [
    { _id: 'pm1', createdFrom: 'Preventive', end_date: '2026-10-20T00:00:00Z', status: 'Completed' },
    { _id: 'pm2', type: 'Preventive Maintenance', end_date: '2026-10-21T00:00:00Z', status: 'Completed' },
    { _id: 'pm3', type: 'PM', end_date: '2026-10-22T00:00:00Z', status: 'Open' },
    { _id: 'rejected', type: 'PM', end_date: '2026-10-22T00:00:00Z', status: 'Rejected' },
    { _id: 'future', type: 'PM', end_date: '2026-10-29T00:00:00Z', status: 'Open' }
  ];
  const result = metrics(orders);
  assert.equal(result.pm_planned, 3);
  assert.equal(result.pm_completed, 2);
  assert.equal(result.pm_overdue, 1);
  assert.equal(result.open_overdue_wos, 2);
  assert.equal(result.overdue_wos, 1);
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

test('missing labor rates, downtime, part price and foreign currency are not reported as known zero costs', () => {
  const result = metrics([{ _id: 'wo', start_date: '2026-10-21T12:00:00Z', type: 'Breakdown', actual_time: 6.3,
    parts: [{ actualQuantity: 2, cost: 100, currency: 'USD' }], labor_entries: [{ hours: 2 }] }]);
  assert.equal(result.breakdown_wos, 1);
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
