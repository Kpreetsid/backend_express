import { Types } from 'mongoose';
import { AssetModel } from '../../modules/assets/models/asset.model';
import { LocationModel } from '../../modules/locations/models/location.model';
import { WorkOrderModel } from '../../modules/work-orders/models/workOrder.model';
import { PartsModel } from '../../modules/inventory/models/part.model';
import { PartsTypeModel } from '../../modules/inventory/models/parts-types.model';
import { ReportAssetModel } from '../../modules/reports/models/assetReport.model';
import { cmmsMetrics, cmmsPeriod, cmmsSpareRows, cmmsSpareResponse, cmmsSummaryResponse, cmmsTabSummary } from './cmms-report';

interface LocationRecord {
  _id: unknown;
  location_name: string;
  parent_id?: unknown;
  top_level?: boolean;
}

interface AssetRecord {
  _id: unknown;
  asset_name: string;
  locationId: unknown;
  parent_id?: unknown;
  top_level_asset_id?: unknown;
  top_level?: boolean;
}

const id = (value: unknown): string => value == null ? '' : String(value);
function fail(message: string, status: number): never {
  throw Object.assign(new Error(message), { status });
}

export function validateCmmsRequest(body: unknown, accountId: unknown): { org_id: string; location_ids: string[] } {
  if (!accountId) fail('Authentication required', 401);
  const input = body as { org_id?: unknown; location_ids?: unknown } | null;
  if (!input || typeof input.org_id !== 'string' || !/^[a-f\d]{24}$/i.test(input.org_id)) {
    fail('org_id must be a valid ObjectId', 400);
  }
  const orgId = input.org_id as string;
  if (orgId.toLowerCase() !== id(accountId).toLowerCase()) fail('Organization access forbidden', 403);
  if (!Array.isArray(input.location_ids) || !input.location_ids.length ||
      input.location_ids.some(value => typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))) {
    fail('location_ids must be a non-empty array of valid ObjectIds', 400);
  }
  return { org_id: orgId.toLowerCase(), location_ids: [...new Set((input.location_ids as string[]).map(value => value.toLowerCase()))] };
}

// Pure assembly keeps hierarchy handling independent of database access.
export function buildCmmsLocationData(locationIds: string[], locations: LocationRecord[], assets: AssetRecord[]) {
  const locationsById = new Map(locations.map(location => [id(location._id), location]));
  const locationChildren = new Map<string, string[]>();
  for (const location of locations) {
    const parent = id(location.parent_id);
    locationChildren.set(parent, [...(locationChildren.get(parent) || []), id(location._id)]);
  }
  for (const locationId of locationIds) {
    if (!locationsById.has(locationId)) fail('One or more locations were not found', 404);
    if (!locationsById.get(locationId)?.top_level) fail('location_ids must contain top-level locations', 400);
  }

  const assetsById = new Map(assets.map(asset => [id(asset._id), asset]));
  const rootOf = (asset: AssetRecord): string | undefined => {
    const visited = new Set<string>();
    let current: AssetRecord | undefined = asset;
    while (current && !visited.has(id(current._id))) {
      const currentId = id(current._id);
      if (current.top_level) return currentId;
      visited.add(currentId);
      const parent = assetsById.get(id(current.parent_id));
      // Prefer the real parent chain; the root reference supports older records.
      current = parent || assetsById.get(id(current.top_level_asset_id));
    }
    return undefined;
  };
  const members = new Map<string, AssetRecord[]>();
  for (const asset of assets) {
    const root = rootOf(asset);
    if (root) members.set(root, [...(members.get(root) || []), asset]);
  }
  const serializeAsset = (asset: AssetRecord) => ({ ...asset, _id: id(asset._id),
    locationId: id(asset.locationId), location_name: locationsById.get(id(asset.locationId))?.location_name || null });

  return locationIds.map(locationId => {
    const descendants = new Set<string>();
    const queue = [locationId];
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (descendants.has(current)) continue;
      descendants.add(current);
      queue.push(...(locationChildren.get(current) || []));
    }
    const assetData = assets.filter(asset => asset.top_level && descendants.has(id(asset.locationId)))
      .map(asset => ({ ...serializeAsset(asset),
        child_assets: (members.get(id(asset._id)) || []).filter(child => id(child._id) !== id(asset._id)).map(serializeAsset)
      }));
    return {
      location_id: locationId,
      location_name: locationsById.get(locationId)!.location_name,
      child_location_ids: [...descendants].filter(value => value !== locationId),
      asset_data: assetData
    };
  });
}

export const cmmsDataService = {
  async getData(body: unknown, accountId: unknown) {
    const request = validateCmmsRequest(body, accountId);
    const now = new Date();
    const period = cmmsPeriod(body, now);
    const scope = { account_id: new Types.ObjectId(request.org_id), visible: true };
    // Two bounded-by-tenant reads avoid a database query for every tree node.
    const [locations, assets] = await Promise.all([
      LocationModel.find(scope).select('_id location_name parent_id top_level').sort({ _id: 1 }).lean(),
      AssetModel.find(scope).sort({ _id: 1 }).lean()
    ]);
    const hierarchy = buildCmmsLocationData(request.location_ids, locations, assets);
    const locationIds = [...new Set(hierarchy.flatMap(location => [location.location_id, ...location.child_location_ids]))];
    const assetIds = [...new Set(hierarchy.flatMap(location => location.asset_data.flatMap(asset => [asset._id, ...asset.child_assets.map(child => child._id)])))];
    const [orders, parts, partTypes, reports] = await Promise.all([
      WorkOrderModel.find({ ...scope, $or: [{ wo_location_id: { $in: locationIds } }, { wo_asset_id: { $in: assetIds } }] })
        .select('_id wo_asset_id wo_location_id createdFrom type nature_of_work status start_date end_date createdAt completed_at actual_end_date actual_time parts labor_entries').lean(),
      PartsModel.find({ ...scope, location_id: { $in: locationIds } }).lean(),
      PartsTypeModel.find(scope).select('_id name').lean(),
      ReportAssetModel.find({ accountId: scope.account_id, visible: true,
        $or: [{ top_level_asset_id: { $in: assetIds } }, { assetId: { $in: assetIds } }] })
        .select('top_level_asset_id assetId createdOn endpointRMSData').sort({ createdOn: 1, _id: 1 }).lean()
    ]);
    const spareRows = cmmsSpareRows(parts, partTypes, new Map(locations.map(location => [id(location._id), location.location_name])));
    const allAssetIds = new Set(assetIds);
    const scopedOrders = orders.filter(order => !order.wo_asset_id || allAssetIds.has(id(order.wo_asset_id)));
    // A part has location stock, but no direct asset/BOM field. Preserve every
    // distinct association evidenced by scoped WOs without multiplying totals.
    const partAssets = new Map<string, Set<string>>();
    for (const order of scopedOrders) {
      const assetId = id(order.wo_asset_id);
      if (!assetId) continue;
      for (const part of order.parts || []) {
        const partId = id(part.part_id);
        if (!partAssets.has(partId)) partAssets.set(partId, new Set());
        partAssets.get(partId)!.add(assetId);
      }
    }
    const replenishmentRows = spareRows.flatMap(part => {
      const linkedAssets = [...(partAssets.get(part.part_id) || [])];
      const associations: (string | null)[] = linkedAssets.length ? linkedAssets : [null];
      return associations.map(assetId => ({ ...part, asset_id: assetId }));
    });
    const locationsData = hierarchy.map(location => {
      const locationSet = new Set([location.location_id, ...location.child_location_ids]);
      const locationAssets = new Set(location.asset_data.flatMap(asset => [asset._id, ...asset.child_assets.map(child => child._id)]));
      const locationOrders = scopedOrders.filter(order => order.wo_asset_id ? locationAssets.has(id(order.wo_asset_id)) : locationSet.has(id(order.wo_location_id)));
      const locationSpares = spareRows.filter(part => locationSet.has(part.location_id));
      return {
        ...location,
        summary: cmmsSummaryResponse(cmmsMetrics(locationOrders, locationSpares, reports, locationAssets, request.org_id, period, now)),
        asset_data: location.asset_data.map(asset => {
          const train = new Set([asset._id, ...asset.child_assets.map(child => child._id)]);
          const trainOrders = locationOrders.filter(order => train.has(id(order.wo_asset_id)));
          const usedParts = new Set(trainOrders.flatMap(order => (order.parts || []).map(part => id(part.part_id))));
          return { ...asset,
            summary: cmmsSummaryResponse(cmmsMetrics(trainOrders, locationSpares.filter(part => usedParts.has(part.part_id)), reports, train, request.org_id, period, now))
          };
        })
      };
    });
    const cmmsSummary = locationsData.flatMap(location => location.asset_data.map(asset => {
      const { low_critical_spares: _lowCriticalSpares, ...summary } = cmmsTabSummary(asset.summary);
      return {
        asset_id: asset._id, asset_name: asset.asset_name || 'N/A',
        location_id: asset.locationId || 'N/A', location_name: asset.location_name || 'N/A', ...summary
      };
    }));
    const weekTotalSnapshot = {
      ...cmmsTabSummary(cmmsSummaryResponse(cmmsMetrics(scopedOrders, spareRows, reports, allAssetIds, request.org_id, period, now))),
      // WO counters match the displayed asset rows.
      planner_wos: cmmsSummary.reduce((total, row) => total + row.planner_wos, 0),
      completed_wos: cmmsSummary.reduce((total, row) => total + row.completed_wos, 0),
      open_overdue_wos: cmmsSummary.reduce((total, row) => total + row.open_overdue_wos, 0),
      breakdown_wos: cmmsSummary.reduce((total, row) => total + row.breakdown_wos, 0),
    };
    return {
      report_period: { from_date: period.from.toISOString(), to_date: period.to.toISOString(), timezone: 'Asia/Kolkata' },
      snapshot_at: now.toISOString(),
      locations: locationsData,
      cmms_summary: cmmsSummary,
      week_total_snapshot: weekTotalSnapshot,
      critical_spares_stock_replenishment: replenishmentRows.map(cmmsSpareResponse),
      metadata: {
        currency: 'INR', stale_after_hours: period.staleAfterHours,
        planner_work_order_basis: 'planner_wos counts visible, non-rejected WOs with createdFrom exactly Preventive, regardless of type or nature_of_work. completed_wos counts Completed WOs from all creation sources; open_overdue_wos counts all other non-rejected statuses from all creation sources once, including overdue work. These are current snapshot counts, independent of report dates. Planner is a source-based subset, not the sum of completed and open WOs.',
        breakdown_work_order_basis: 'breakdown_wos counts visible, non-rejected WOs with nature_of_work exactly Breakdown, across all creation sources, statuses and dates. The total sums displayed asset rows.',
        work_order_basis: 'Actual consumption uses WOs starting in the period (creation date fallback). Quantities and costs are cumulative for that cohort.',
        labor_cost_basis: 'Labor cost sums recorded labor_entries.labor_cost amounts for that cohort as INR entry totals, without multiplying by hours. Unpriced entries are excluded; totals reflect recorded costs only. If labor is logged but no cost is recorded, the unavailable-value response default is 0.',
        snapshot_basis: 'Planner, completed and open/overdue WOs and inventory use current stored state; date filters do not reconstruct historical state.',
        sensor_source: 'Persisted asset report endpointRMSData.velocity, not a live processor query.',
        sensor_basis: 'Peak is the historical maximum in saved reports as of snapshot_at; oldest is the oldest reading in the most recent saved snapshot for each endpoint axis.',
        sensor_reading_timezone: 'Asia/Kolkata', sensor_reading_format: 'dd/mm/yyyy hh:mm:ss (24-hour)',
        summary_basis: 'cmms_summary contains top-level assets only. Location summaries include location-only WOs. week_total_snapshot planner_wos, completed_wos, open_overdue_wos and breakdown_wos sum displayed asset rows; other totals use unique scoped records including location-only WOs.',
        asset_spare_basis: 'Asset stock association is inferred from WO part references. Spare rows have one row per part and associated asset_id, or N/A asset_id if unlinked; shared stock is repeated per asset and location/global stock counts deduplicate part IDs.',
        response_defaults: 'Missing numeric report values are returned as 0; missing text/date report values as N/A. These defaults do not establish recorded measurements or costs; data quality flags retain source-data status.',
        unavailable_source_fields: ['downtime_h when breakdowns exist: equipment downtime is not recorded',
          'labor_cost_inr when labor is logged but no valid entry cost is recorded; unpriced labor is excluded from recorded-cost totals',
          'total_cost_inr when either cost component is unavailable',
          'low_critical_spares when low-stock parts have unknown criticality',
          'INR amounts when the source currency differs; no exchange rate is assumed'],
        data_quality_flags: { RECENT: 'All saved readings are within stale_after_hours', STALE: 'At least one saved reading is older than the threshold',
          MISSING: 'At least one saved endpoint axis has missing RMS or timestamp', NO_DATA: 'No saved velocity endpoint axes found' }
      }
    };
  }
};
