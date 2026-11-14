import { AssetModel } from '../../models/asset.model';
import { MapUserAssetLocationModel } from '../../models/mapUserLocation.model';
import { UserModel } from '../../models/user.model';
import {
  failure,
  normalizeNotifications,
  notificationPatch,
  record,
  validId
} from './userNotifications.validator';

export const tenantMapping = (accountId: string) => ({
  $or: [{ account_id: accountId }, { account_id: { $exists: false } }]
});

export const mappingBelongsToTenant = (mapping: any, accountId: string): boolean =>
  mapping.account_id === undefined || String(mapping.account_id) === accountId;

export function assetSummary(asset: any) {
  return {
    id: String(asset._id),
    name: asset.asset_name,
    ...(asset.parent_id ? { parentId: String(asset.parent_id) } : {})
  };
}

export function mappingSummary(mapping: any, asset: any) {
  return {
    mappingId: String(mapping._id),
    asset: assetSummary(asset),
    notifications: normalizeNotifications(mapping.notifications)
  };
}

export async function getUserNotifications(accountId: string, rawUserId: unknown) {
  const userId = validId(rawUserId, 'userId');
  const user = await UserModel.findOne({ _id: userId, account_id: accountId }).select('_id').lean();
  if (!user) throw failure('User not found', 404);

  // Assets also provide tenant-checked ancestor names; no unrelated assets enter the response.
  const assets: any[] = await AssetModel.find({ account_id: accountId, visible: true })
    .select('_id asset_name parent_id')
    .lean();
  const byId = new Map<string, any>(assets.map((asset: any) => [String(asset._id), asset]));
  if (!assets.length) return { data: [] };

  const mappings: any[] = await MapUserAssetLocationModel.find({
    userId,
    assetId: { $in: assets.map((asset: any) => asset._id) },
    ...tenantMapping(accountId)
  }).select('_id userId assetId account_id notifications').lean();

  const data = mappings
    .filter((mapping: any) => mappingBelongsToTenant(mapping, accountId) && byId.has(String(mapping.assetId)))
    .map((mapping: any) => mappingSummary(mapping, byId.get(String(mapping.assetId))));

  const withAncestors = data.map((mapping: any) => {
    const ancestors: ReturnType<typeof assetSummary>[] = [];
    let parentId = mapping.asset.parentId;
    const visited = new Set<string>([mapping.asset.id]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      const summary = assetSummary(parent);
      ancestors.push(summary);
      parentId = summary.parentId;
    }
    return { ...mapping, assetAncestors: ancestors };
  });
  return { data: withAncestors };
}

export async function patchUserNotifications(accountId: string, rawMappingId: unknown, body: unknown) {
  const mappingId = validId(rawMappingId, 'mappingId');
  const leaves = notificationPatch(body);
  const mapping = await MapUserAssetLocationModel.findOne({ _id: mappingId, ...tenantMapping(accountId) })
    .select('_id userId assetId account_id').lean();
  if (!mapping || !mapping.assetId || !mappingBelongsToTenant(mapping, accountId)) {
    throw failure('Asset user mapping not found', 404);
  }
  const [user, asset] = await Promise.all([
    UserModel.findOne({ _id: mapping.userId, account_id: accountId }).select('_id').lean(),
    AssetModel.findOne({ _id: mapping.assetId, account_id: accountId, visible: true }).select('_id asset_name parent_id').lean()
  ]);
  if (!user || !asset) throw failure('Asset user mapping not found', 404);
  const updated = await MapUserAssetLocationModel.findOneAndUpdate({
    _id: mappingId, userId: mapping.userId, assetId: mapping.assetId, ...tenantMapping(accountId)
  }, { $set: leaves }, { new: true, runValidators: true, upsert: false })
    .select('_id notifications').lean();
  if (!updated) throw failure('Asset user mapping not found', 404);
  return mappingSummary(updated, asset);
}

export async function updateUserNotificationsByUser(accountId: string, body: unknown) {
  if (!record(body)) {
    throw failure('Provide an update payload with userId and mappings', 400);
  }
  const userId = validId(body.userId, 'userId');
  const user = await UserModel.findOne({ _id: userId, account_id: accountId }).select('_id').lean();
  if (!user) throw failure('User not found', 404);

  if (Array.isArray(body.mappings)) {
    if (!body.mappings.length) {
      throw failure('Provide a nonempty mappings array', 400);
    }
    const bulkOps = [];
    for (const item of body.mappings) {
      if (!record(item)) {
        throw failure('Each mapping update must be an object', 400);
      }
      if (!item.mappingId && !item.assetId) {
        throw failure('Each mapping update must supply mappingId or assetId', 400);
      }
      const mappingId = item.mappingId ? validId(item.mappingId, 'mappingId') : undefined;
      const assetId = item.assetId ? validId(item.assetId, 'assetId') : undefined;
      const leaves = notificationPatch({ notifications: item.notifications });

      const filter: any = {
        userId,
        ...tenantMapping(accountId)
      };
      if (mappingId) {
        filter._id = mappingId;
      }
      if (assetId) {
        filter.assetId = assetId;
      }

      bulkOps.push({
        updateOne: {
          filter,
          update: { $set: leaves }
        }
      });
    }

    const bulkResult = await MapUserAssetLocationModel.bulkWrite(bulkOps, { ordered: false });
    return {
      status: true,
      message: `Notification preferences updated for ${bulkOps.length} assets`,
      matchedCount: bulkResult.matchedCount,
      modifiedCount: bulkResult.modifiedCount
    };
  }

  if (record(body.notifications)) {
    const leaves = notificationPatch({ notifications: body.notifications });
    const assets: any[] = await AssetModel.find({ account_id: accountId, visible: true }).select('_id').lean();
    if (!assets.length) {
      return { status: true, message: 'No assets available to update', modifiedCount: 0 };
    }
    const result = await MapUserAssetLocationModel.updateMany({
      userId,
      assetId: { $in: assets.map((a: any) => a._id) },
      ...tenantMapping(accountId)
    }, { $set: leaves });

    return {
      status: true,
      message: 'Notification preferences updated for all assigned assets',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    };
  }

  throw failure('Provide mappings or notifications in request body', 400);
}

export class UserNotificationsService {
  getUserNotifications = getUserNotifications;
  patchUserNotifications = patchUserNotifications;
  updateUserNotificationsByUser = updateUserNotificationsByUser;
}

export const userNotificationsService = new UserNotificationsService();
