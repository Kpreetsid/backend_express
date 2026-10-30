// Report calculations use persisted facts only. Missing facts stay null.
export interface CmmsOrder {
  _id: unknown;
  wo_asset_id?: unknown;
  wo_location_id?: unknown;
  createdFrom?: string;
  type?: string;
  nature_of_work?: string;
  status?: string;
  start_date?: unknown;
  end_date?: unknown;
  createdAt?: unknown;
  completed_at?: unknown;
  actual_end_date?: unknown;
  actual_time?: number;
  parts?: { part_id?: unknown; actualQuantity?: number; issuedQuantity?: number; returnedQuantity?: number; cost?: number; currency?: string }[];
  labor_entries?: { hours: number; labor_cost?: number | null }[];
}

export interface CmmsPart {
  _id: unknown;
  part_name: string;
  part_number: string;
  part_type?: unknown;
  location_id?: unknown;
  quantity: number;
  min_quantity: number;
  cost: number;
  currency?: string;
  preferred_vendor?: string;
  lead_time_days?: number;
}

interface RmsReading { rms?: unknown; timestamp?: unknown }
export interface CmmsSensorReport {
  top_level_asset_id?: unknown;
  assetId?: unknown;
  createdOn?: unknown;
  endpointRMSData?: { asset_id?: string; org_id?: string; composite_id?: string;
    point_name?: string; mount_location?: string; velocity?: {
      Axial?: RmsReading; Horizontal?: RmsReading; Vertical?: RmsReading;
    } }[];
}

export interface CmmsPeriod { from: Date; to: Date; staleAfterHours: number }
const key = (value: unknown): string => value == null ? '' : String(value);
const round = (value: number): number => Number(value.toFixed(2));
const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};
export function reportDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  const numeric = typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) ? Number(value) : null;
  const date = numeric !== null ? new Date(numeric < 1e12 ? numeric * 1000 : numeric) : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatIst(date: Date): string {
  const local = new Date(date.getTime() + 330 * 60000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = [pad(local.getUTCDate()), pad(local.getUTCMonth() + 1), local.getUTCFullYear()].join('/');
  const time = [pad(local.getUTCHours()), pad(local.getUTCMinutes()), pad(local.getUTCSeconds())].join(':');
  return `${day} ${time}`;
}

export function cmmsPeriod(body: unknown, now = new Date()): CmmsPeriod {
  const input = body as { from_date?: unknown; to_date?: unknown; stale_after_hours?: unknown };
  const offset = 330 * 60000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  const parseInput = (value: unknown, end: boolean): Date | null => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$)/.test(value)) return null;
    const day = value.slice(0, 10);
    const date = reportDate(value.length === 10 ? `${day}T${end ? '23:59:59.999' : '00:00:00.000'}+05:30` : value);
    const dayCheck = new Date(`${day}T00:00:00Z`);
    return date && Number.isFinite(dayCheck.getTime()) && dayCheck.toISOString().slice(0, 10) === day ? date : null;
  };
  const from = input.from_date === undefined ? new Date(local.getTime() - offset) : parseInput(input.from_date, false);
  const to = input.to_date === undefined ? now : parseInput(input.to_date, true);
  const staleAfterHours = input.stale_after_hours === undefined ? 24 :
    typeof input.stale_after_hours === 'number' ? number(input.stale_after_hours) : null;
  if (!from || !to || from > to || staleAfterHours === null || staleAfterHours <= 0) {
    throw Object.assign(new Error('Invalid report period or stale_after_hours; use ISO dates and a positive number'), { status: 400 });
  }
  return { from, to, staleAfterHours };
}

function sensorMetrics(reports: CmmsSensorReport[], assetIds: Set<string>, orgId: string, asOf: Date, staleHours: number) {
  let peak: number | null = null;
  const latest = new Map<string, { rms: number | null; timestamp: Date | null; savedAt: number }>();
  for (const report of reports) {
    const saved = reportDate(report.createdOn);
    if (!saved || saved > asOf) continue;
    for (const point of report.endpointRMSData || []) {
      // Explicit component identity wins over the enclosing train report identity.
      const assetId = point.asset_id || key(report.assetId) || key(report.top_level_asset_id);
      if (!assetIds.has(assetId) || (point.org_id && point.org_id !== orgId)) continue;
      for (const axis of ['Axial', 'Horizontal', 'Vertical'] as const) {
        const reading = point.velocity?.[axis];
        if (!reading) continue;
        const rms = number(reading.rms);
        const timestamp = reportDate(reading.timestamp);
        if (timestamp && timestamp > asOf) continue;
        if (rms !== null) peak = peak === null ? rms : Math.max(peak, rms);
        const sensorKey = `${assetId}:${point.composite_id || `${point.point_name}:${point.mount_location}`}:${axis}`;
        const existing = latest.get(sensorKey);
        if (!existing || saved.getTime() >= existing.savedAt) {
          latest.set(sensorKey, { rms, timestamp, savedAt: saved.getTime() });
        }
      }
    }
  }
  const readings = [...latest.values()];
  const dates = readings.flatMap(reading => reading.timestamp ? [reading.timestamp.getTime()] : []);
  const oldest = dates.length ? new Date(Math.min(...dates)) : null;
  const missing = readings.some(reading => reading.rms === null || !reading.timestamp);
  return {
    peak_endpoint_rms_mm_s: peak,
    oldest_sensor_reading: oldest ? formatIst(oldest) : null,
    data_quality_flag: !readings.length ? 'NO_DATA' : missing ? 'MISSING' :
      oldest && asOf.getTime() - oldest.getTime() > staleHours * 3600000 ? 'STALE' : 'RECENT'
  };
}

export function cmmsSpareRows(parts: CmmsPart[], partTypes: { _id: unknown; name: string }[], locations: Map<string, string>) {
  const names = new Map(partTypes.map(type => [key(type._id), type.name]));
  return parts.map(part => {
    const stock = number(part.quantity);
    const minimum = number(part.min_quantity);
    const type = names.get(key(part.part_type));
    const classification = type?.toLowerCase() === 'critical' ? 'Critical' : type?.toLowerCase() === 'general' ? 'General' : null;
    const status = stock === null || minimum === null ? 'UNKNOWN' : stock === 0 ? 'OUT OF STOCK' : stock < minimum ? 'LOW' : 'OK';
    return {
      part_id: key(part._id), location_id: key(part.location_id), location_name: locations.get(key(part.location_id)) || null,
      spare_part_name: part.part_name, spare_part_code: part.part_number, classification,
      on_hand_stock: stock, min_stock: minimum, max_stock: null,
      stock_status: status, reorder_to_max_qty: status === 'OK' ? 0 : null,
      lead_time_days: part.lead_time_days ?? null, unit_cost_inr: part.currency && part.currency !== 'INR' ? null : number(part.cost),
      replenishment_inr: status === 'OK' ? 0 : null, supplier: part.preferred_vendor || null,
      responsible_group: null,
      action_alert: status === 'OUT OF STOCK' ? 'Urgent procurement' : status === 'LOW' ? 'Raise purchase request' :
        status === 'OK' ? 'Within stock policy' : 'Review stock data'
    };
  });
}

type SpareRow = ReturnType<typeof cmmsSpareRows>[number];

// Apply API display defaults after calculations so missing source data still
// participates in quality checks and is never treated as a recorded zero.
export function cmmsSummaryResponse(summary: ReturnType<typeof cmmsMetrics>) {
  return {
    ...summary,
    downtime_h: summary.downtime_h ?? 0,
    spare_cost_inr: summary.spare_cost_inr ?? 0,
    labor_cost_inr: summary.labor_cost_inr ?? 0,
    total_cost_inr: summary.total_cost_inr ?? 0,
    low_critical_spares: summary.low_critical_spares ?? 0,
    peak_endpoint_rms_mm_s: summary.peak_endpoint_rms_mm_s ?? 0,
    oldest_sensor_reading: summary.oldest_sensor_reading || 'N/A'
  };
}

export function cmmsTabSummary(summary: ReturnType<typeof cmmsSummaryResponse>) {
  const { peak_endpoint_rms_mm_s: _peak, oldest_sensor_reading: _oldest,
    data_quality_flag: _quality, ...maintenance } = summary;
  return maintenance;
}

export function cmmsSpareResponse(row: SpareRow & { asset_id: string | null }) {
  return {
    part_id: row.part_id,
    asset_id: row.asset_id || 'N/A',
    location_id: row.location_id || 'N/A', location_name: row.location_name || 'N/A',
    spare_part_name: row.spare_part_name || 'N/A', spare_part_code: row.spare_part_code || 'N/A',
    supplier: row.supplier || 'N/A',
    on_hand_stock: row.on_hand_stock ?? 0, min_stock: row.min_stock ?? 0,
    lead_time_days: row.lead_time_days ?? 0, unit_cost_inr: row.unit_cost_inr ?? 0,
    stock_status: row.stock_status, action_alert: row.action_alert
  };
}

export function cmmsMetrics(orders: CmmsOrder[], spares: SpareRow[], reports: CmmsSensorReport[],
  assetIds: Set<string>, orgId: string, period: CmmsPeriod, asOf: Date) {
  const inPeriod = (value: unknown) => {
    const date = reportDate(value);
    return !!date && date >= period.from && date <= period.to;
  };
  const breakdown = (order: CmmsOrder) => order.nature_of_work === 'Breakdown';
  const eligibleOrders = orders.filter(order => order.status !== 'Rejected');
  // Planner is identified by its creation source, not its type or nature of work.
  const plannerCount = eligibleOrders.filter(order => order.createdFrom === 'Preventive').length;
  const completedCount = eligibleOrders.filter(order => order.status === 'Completed').length;
  const cohort = orders.filter(order => order.status !== 'Rejected' && inPeriod(order.start_date || order.createdAt));
  let spareQty = 0;
  let spareCost: number | null = 0;
  for (const order of cohort) {
    for (const part of order.parts || []) {
      // Never substitute planned/estimated quantities for real consumption.
      const quantity = number(part.actualQuantity) ?? Math.max(0, (number(part.issuedQuantity) || 0) - (number(part.returnedQuantity) || 0));
      spareQty += quantity;
      if (quantity > 0) {
        const cost = number(part.cost);
        if (cost === null || (part.currency && part.currency !== 'INR')) spareCost = null;
        else if (spareCost !== null) spareCost += quantity * cost;
      }
    }
  }
  // labor_cost is the total amount for an entry, not an hourly rate. Sum
  // recorded amounts even when other entries have no cost; never infer rates.
  const recordedLaborCosts = cohort.flatMap(order => (order.labor_entries || [])
    .map(entry => number(entry.labor_cost)).filter((cost): cost is number => cost !== null));
  const laborUnpriced = cohort.some(order => (number(order.actual_time) || 0) > 0 ||
    (order.labor_entries || []).some(entry => (number(entry.hours) || 0) > 0));
  const breakdownCount = cohort.filter(breakdown).length;
  const laborCost = recordedLaborCosts.length
    ? round(recordedLaborCosts.reduce((total, cost) => total + cost, 0))
    : laborUnpriced ? null : 0;
  return {
    planner_wos: plannerCount,
    completed_wos: completedCount,
    open_overdue_wos: eligibleOrders.length - completedCount,
    breakdown_wos: eligibleOrders.filter(breakdown).length,
    downtime_h: breakdownCount ? null : 0,
    spare_qty_used: round(spareQty), spare_cost_inr: spareCost === null ? null : round(spareCost),
    labor_cost_inr: laborCost,
    total_cost_inr: spareCost === null || laborCost === null ? null : round(spareCost + laborCost),
    low_critical_spares: spares.some(part => part.classification === null && ['LOW', 'OUT OF STOCK', 'UNKNOWN'].includes(part.stock_status)) ? null :
      spares.filter(part => part.classification === 'Critical' && ['LOW', 'OUT OF STOCK'].includes(part.stock_status)).length,
    ...sensorMetrics(reports, assetIds, orgId, asOf, period.staleAfterHours)
  };
}
