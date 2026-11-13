import { NextFunction, Request, Response, Router } from 'express';
import { Types } from 'mongoose';
import { accountAccessService } from '../_role/accountAccess.service';
import { AssetModel } from '../models/asset.model';
import { MapUserAssetLocationModel } from '../models/mapUserLocation.model';
import { UserModel } from '../models/user.model';

const channels = ['email', 'push', 'sms', 'whatsapp'] as const;
const severities = ['alert', 'danger', 'critical'] as const;
type Notifications = Record<typeof channels[number], Record<typeof severities[number], boolean>>;
const failure = (message: string, status: number) => Object.assign(new Error(message), { status });
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeNotifications(value: any): Notifications {
  return Object.fromEntries(channels.map(channel => [channel,
    Object.fromEntries(severities.map(severity => [severity, value?.[channel]?.[severity] === true]))
  ])) as Notifications;
}

export function notificationPatch(body: unknown): Record<string, boolean> {
  if (!record(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'notifications') ||
      !record(body.notifications) || !Object.keys(body.notifications).length) {
    throw failure('Provide a nonempty notifications object', 400);
  }
  const leaves: Record<string, boolean> = {};
  for (const [channel, levels] of Object.entries(body.notifications)) {
    if (!(channels as readonly string[]).includes(channel) || !record(levels) || !Object.keys(levels).length) {
      throw failure('Unknown or empty notification channel', 400);
    }
    for (const [severity, enabled] of Object.entries(levels)) {
      if (!(severities as readonly string[]).includes(severity) || typeof enabled !== 'boolean') {
        throw failure('Notification severities must be known boolean values', 400);
      }
      leaves[`notifications.${channel}.${severity}`] = enabled;
    }
  }
  return leaves;
}

function validId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-fA-F0-9]{24}$/.test(value)) {
    throw failure(`Invalid ${label}`, 400);
  }
  return value;
}

const tenantMapping = (accountId: string) => ({
  $or: [{ account_id: accountId }, { account_id: { $exists: false } }]
});
const mappingBelongsToTenant = (mapping: any, accountId: string): boolean =>
  mapping.account_id === undefined || String(mapping.account_id) === accountId;

function assetSummary(asset: any) {
  return { id: String(asset._id), name: asset.asset_name,
    ...(asset.parent_id ? { parentId: String(asset.parent_id) } : {}) };
}

function mappingSummary(mapping: any, asset: any) {
  return { mappingId: String(mapping._id), asset: assetSummary(asset),
    notifications: normalizeNotifications(mapping.notifications) };
}

export async function getUserNotifications(accountId: string, rawUserId: unknown) {
  const userId = validId(rawUserId, 'userId');
  const user = await UserModel.findOne({ _id: userId, account_id: accountId }).select('_id').lean();
  if (!user) throw failure('User not found', 404);
  // Assets also provide tenant-checked ancestor names; no unrelated assets enter the response.
  const assets = await AssetModel.find({ account_id: accountId, visible: true }).select('_id asset_name parent_id').lean();
  const byId = new Map(assets.map(asset => [String(asset._id), asset]));
  if (!assets.length) return { data: [] };
  const mappings = await MapUserAssetLocationModel.find({ userId,
    assetId: { $in: assets.map(asset => asset._id) }, ...tenantMapping(accountId)
  }).select('_id userId assetId account_id notifications').lean();
  const data = mappings.filter(mapping => mappingBelongsToTenant(mapping, accountId) && byId.has(String(mapping.assetId)))
    .map(mapping => mappingSummary(mapping, byId.get(String(mapping.assetId))));
  const withAncestors = data.map(mapping => {
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

export const notificationPermission = (action: 'view' | 'edit') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const context = req as any;
    if (!context.user?.account_id || !Types.ObjectId.isValid(String(context.user.account_id))) {
      next(failure('Unauthorized access', 401)); return;
    }
    if (!accountAccessService.isEffectivePermissionEnabled(context.roleMenu, 'master_admin_panel', 'view') ||
        !accountAccessService.isEffectivePermissionEnabled(context.roleMenu, 'asset_mail', action)) {
      next(failure('You do not have permission to access asset notifications', 403)); return;
    }
    next();
  };

export function userNotificationRoutes(router: Router): void {
  router.get('/user-notifications', notificationPermission('view'), async (req, res, next) => {
    try {
      const result = await getUserNotifications(String((req as any).user.account_id), req.query.userId);
      res.status(200).json({ status: true, ...result });
    } catch (error) { next(error); }
  });
  router.patch('/user-notifications/:mappingId', notificationPermission('edit'), async (req, res, next) => {
    try {
      const data = await patchUserNotifications(String((req as any).user.account_id), req.params.mappingId, req.body);
      res.status(200).json({ status: true, data });
    } catch (error) { next(error); }
  });
}
