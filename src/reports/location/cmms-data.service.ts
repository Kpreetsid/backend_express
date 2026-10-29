import { Types } from 'mongoose';
import { AssetModel } from '../../modules/assets/models/asset.model';
import { LocationModel } from '../../modules/locations/models/location.model';
import { WorkOrderModel } from '../../modules/work-orders/models/workOrder.model';
import { PartsModel } from '../../modules/inventory/models/part.model';
import { PartsTypeModel } from '../../modules/inventory/models/parts-types.model';
import { ReportAssetModel } from '../../modules/reports/models/assetReport.model';
import { cmmsMetrics, cmmsPeriod, cmmsSpareRows } from './cmms-report';

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
    const assetsById = new Map(assets.map(asset => [id(asset._id), asset]));
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
      return associations.map(assetId => ({ ...part, asset_id: assetId,
        asset_name: assetId ? assetsById.get(assetId)?.asset_name ?? null : null }));
    });
    const locationsData = hierarchy.map(location => {
      const locationSet = new Set([location.location_id, ...location.child_location_ids]);
      const locationAssets = new Set(location.asset_data.flatMap(asset => [asset._id, ...asset.child_assets.map(child => child._id)]));
      const locationOrders = scopedOrders.filter(order => order.wo_asset_id ? locationAssets.has(id(order.wo_asset_id)) : locationSet.has(id(order.wo_location_id)));
      const locationSpares = spareRows.filter(part => locationSet.has(part.location_id));
      return {
        ...location,
        summary: cmmsMetrics(locationOrders, locationSpares, reports, locationAssets, request.org_id, period, now),
        asset_data: location.asset_data.map(asset => {
          const train = new Set([asset._id, ...asset.child_assets.map(child => child._id)]);
          const trainOrders = locationOrders.filter(order => train.has(id(order.wo_asset_id)));
          const usedParts = new Set(trainOrders.flatMap(order => (order.parts || []).map(part => id(part.part_id))));
          return { ...asset,
            summary: cmmsMetrics(trainOrders, locationSpares.filter(part => usedParts.has(part.part_id)), reports, train, request.org_id, period, now)
          };
        })
      };
    });
    return {
      report_period: { from_date: period.from.toISOString(), to_date: period.to.toISOString(), timezone: 'Asia/Kolkata' },
      snapshot_at: now.toISOString(),
      locations: locationsData,
      cmms_summary: locationsData.flatMap(location => location.asset_data.map(asset => ({
        asset_id: asset._id, asset_name: asset.asset_name,
        location_id: asset.locationId, location_name: asset.location_name, ...asset.summary
      }))),
      week_total_snapshot: cmmsMetrics(scopedOrders, spareRows, reports, allAssetIds, request.org_id, period, now),
      critical_spares_stock_replenishment: replenishmentRows,
      metadata: {
        currency: 'INR', stale_after_hours: period.staleAfterHours,
        pm_basis: 'Visible, non-rejected preventive WOs due in the period (start date fallback); completed and overdue use this same cohort.',
        work_order_basis: 'Breakdown and actual consumption use WOs starting in the period (creation date fallback). Quantities and costs are cumulative for that cohort.',
        snapshot_basis: 'Open/overdue WOs and inventory use current stored state; date filters do not reconstruct historical state.',
        open_work_order_basis: 'open_overdue_wos counts all non-completed/non-rejected WOs once, including overdue ones; overdue_wos provides the overdue subset.',
        sensor_source: 'Persisted asset report endpointRMSData.velocity, not a live processor query.',
        sensor_basis: 'Peak is the historical maximum in saved reports as of snapshot_at; oldest is the oldest reading in the most recent saved snapshot for each endpoint axis.',
        sensor_reading_timezone: 'Asia/Kolkata', sensor_reading_format: 'dd/mm/yyyy hh:mm:ss (24-hour)',
        summary_basis: 'cmms_summary contains top-level assets only; location-only WOs remain in location summaries and week_total_snapshot.',
        asset_spare_basis: 'Asset stock association is inferred from WO part references. Replenishment has one row per part and associated asset, or null asset fields if unlinked; shared stock is repeated per asset and location/global stock counts deduplicate part IDs.',
        null_fields: ['downtime_h when breakdowns exist: equipment downtime is not recorded',
          'labor_cost_inr when labor is logged: labor rates are not recorded',
          'total_cost_inr when either cost component is unavailable',
          'max_stock, reorder_to_max_qty and replenishment_inr for low stock: maximum stock is not recorded',
          'responsible_group: not recorded',
          'classification when the part type is neither Critical nor General',
          'low_critical_spares when low-stock parts have unknown criticality',
          'INR amounts when the source currency differs; no exchange rate is assumed'],
        data_quality_flags: { RECENT: 'All saved readings are within stale_after_hours', STALE: 'At least one saved reading is older than the threshold',
          MISSING: 'At least one saved endpoint axis has missing RMS or timestamp', NO_DATA: 'No saved velocity endpoint axes found' }
      }
    };
  }
};
