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
  labor_entries?: { hours: number }[];
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
export function cmmsMetrics(orders: CmmsOrder[], spares: SpareRow[], reports: CmmsSensorReport[],
  assetIds: Set<string>, orgId: string, period: CmmsPeriod, asOf: Date) {
  const inPeriod = (value: unknown) => {
    const date = reportDate(value);
    return !!date && date >= period.from && date <= period.to;
  };
  const normalized = (value?: string) => (value || '').toLowerCase().replace(/[^a-z]/g, '');
  const terminal = (order: CmmsOrder) => ['Completed', 'Rejected'].includes(order.status || '');
  const preventive = (order: CmmsOrder) => order.createdFrom === 'Preventive' ||
    ['preventive', 'preventivemaintenance', 'pm'].includes(normalized(order.type));
  const breakdown = (order: CmmsOrder) => [order.type, order.nature_of_work].some(value => normalized(value).startsWith('breakdown'));
  // Ignore rejected/cancelled planned work and keep the same PM cohort for all three counts.
  const planned = orders.filter(order => order.status !== 'Rejected' && preventive(order) && inPeriod(order.end_date || order.start_date));
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
  const laborUnpriced = cohort.some(order => (number(order.actual_time) || 0) > 0 ||
    (order.labor_entries || []).some(entry => (number(entry.hours) || 0) > 0));
  const breakdownCount = cohort.filter(breakdown).length;
  const laborCost = laborUnpriced ? null : 0;
  return {
    pm_planned: planned.length,
    pm_completed: planned.filter(order => order.status === 'Completed').length,
    pm_overdue: planned.filter(order => !terminal(order) && !!reportDate(order.end_date) && reportDate(order.end_date)! < asOf).length,
    breakdown_wos: breakdownCount,
    downtime_h: breakdownCount ? null : 0,
    open_overdue_wos: orders.filter(order => !terminal(order)).length,
    overdue_wos: orders.filter(order => !terminal(order) && !!reportDate(order.end_date) && reportDate(order.end_date)! < asOf).length,
    spare_qty_used: round(spareQty), spare_cost_inr: spareCost === null ? null : round(spareCost),
    labor_cost_inr: laborCost,
    total_cost_inr: spareCost === null || laborCost === null ? null : round(spareCost + laborCost),
    low_critical_spares: spares.some(part => part.classification === null && ['LOW', 'OUT OF STOCK', 'UNKNOWN'].includes(part.stock_status)) ? null :
      spares.filter(part => part.classification === 'Critical' && ['LOW', 'OUT OF STOCK'].includes(part.stock_status)).length,
    ...sensorMetrics(reports, assetIds, orgId, asOf, period.staleAfterHours)
  };
}
