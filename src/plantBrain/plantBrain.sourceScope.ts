import { createHash, randomUUID } from 'crypto';
import { Request } from 'express';
import { get } from 'lodash';
import mongoose from 'mongoose';
import { AssetModel } from '../models/asset.model';
import { LocationModel } from '../models/location.model';
import { MapUserAssetLocationModel } from '../models/mapUserLocation.model';
import { IUser } from '../models/user.model';
import { PlantBrainScopeError } from './plantBrain.scope';

export interface PlantBrainSourceScopeData {
  schemaVersion: 'plant_brain_scope_v1';
  tokenId: string;
  tenantId: string;
  principalId: string;
  allowedLocationIds: string[];
  allowedAssetIds: string[];
  permissions: ['plant.read'];
  issuedAt: string;
  expiresAt: string;
  scopeHash: string;
}

const objectId = (value: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new PlantBrainScopeError(`${label} is invalid`, 401, 'authenticated_scope_invalid');
  }
  return new mongoose.Types.ObjectId(value);
};

const canonicalHash = (value: Record<string, unknown>): string => {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) ordered[key] = value[key];
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
};

const firstHeader = (req: Request, name: string): string => {
  const raw = req.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Builds the authoritative parent scope consumed by Plant Brain's Presage scope adapter.
 * The bearer token has already been verified by the existing CMMS isAuthenticated middleware.
 * accountid and X-User-ID are required as explicit consistency checks and must match req.user.
 */
export const resolvePlantBrainSourceScope = async (
  req: Request,
  now = new Date()
): Promise<PlantBrainSourceScopeData> => {
  const user = get(req, 'user', {}) as IUser;
  const accountId = user.account_id?.toString();
  const principalId = user._id?.toString();
  const userRole = user.user_role;
  if (!accountId || !principalId || !userRole) {
    throw new PlantBrainScopeError('Authenticated user context is incomplete', 401, 'missing_authenticated_context');
  }

  const requestedAccountId = firstHeader(req, 'accountid');
  const requestedUserId = firstHeader(req, 'x-user-id');
  if (!requestedAccountId || requestedAccountId !== accountId || !requestedUserId || requestedUserId !== principalId) {
    throw new PlantBrainScopeError('Plant Brain scope headers do not match the authenticated principal', 403, 'scope_identity_mismatch');
  }

  const accountObjectId = objectId(accountId, 'authenticated account');
  const principalObjectId = objectId(principalId, 'authenticated principal');

  let authorizedAssetIds: mongoose.Types.ObjectId[];
  if (userRole === 'admin') {
    const assets = await AssetModel.find({ account_id: accountObjectId, visible: true }).select('_id').lean();
    authorizedAssetIds = assets.map((asset: any) => asset._id as mongoose.Types.ObjectId);
  } else {
    const mappings = await MapUserAssetLocationModel.find({
      userId: principalObjectId,
      assetId: { $exists: true, $ne: null }
    }).select('assetId').lean();
    const unique = new Set(
      mappings
        .map((mapping: any) => mapping.assetId?.toString())
        .filter((value: string | undefined): value is string => typeof value === 'string' && Boolean(value))
    );
    authorizedAssetIds = [...unique].filter(value => mongoose.Types.ObjectId.isValid(value)).map(value => new mongoose.Types.ObjectId(value));
  }

  const assets: any[] = authorizedAssetIds.length
    ? await AssetModel.find({
      _id: { $in: authorizedAssetIds },
      account_id: accountObjectId,
      visible: true
    }).select('_id locationId').lean()
    : [];

  const directLocationIds = [...new Set(
    assets
      .map(asset => asset.locationId?.toString())
      .filter((value: string | undefined): value is string => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value))
  )];

  const locations: any[] = directLocationIds.length
    ? await LocationModel.find({
      _id: { $in: directLocationIds.map(value => new mongoose.Types.ObjectId(value)) },
      account_id: accountObjectId,
      visible: true
    }).select('_id top_level top_level_location_id').lean()
    : [];

  const rootIds = [...new Set(
    locations
      .map(location => location.top_level ? location._id?.toString() : location.top_level_location_id?.toString())
      .filter((value: string | undefined): value is string => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value))
  )];

  const verifiedRoots: any[] = rootIds.length
    ? await LocationModel.find({
      _id: { $in: rootIds.map(value => new mongoose.Types.ObjectId(value)) },
      account_id: accountObjectId,
      visible: true,
      top_level: true
    }).select('_id').lean()
    : [];

  const allowedAssetIds = assets.map(asset => asset._id.toString()).sort();
  const allowedLocationIds = verifiedRoots.map(location => location._id.toString()).sort();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const tokenId = randomUUID();
  const scopeWithoutHash = {
    schemaVersion: 'plant_brain_scope_v1' as const,
    tokenId,
    tenantId: accountId,
    principalId,
    allowedLocationIds,
    allowedAssetIds,
    permissions: ['plant.read'] as ['plant.read'],
    issuedAt,
    expiresAt
  };

  return {
    ...scopeWithoutHash,
    scopeHash: canonicalHash(scopeWithoutHash)
  };
};
