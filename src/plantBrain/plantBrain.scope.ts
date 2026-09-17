import { Request } from 'express';
import { get } from 'lodash';
import mongoose from 'mongoose';
import { AssetModel } from '../models/asset.model';
import { LocationModel } from '../models/location.model';
import { MapUserAssetLocationModel } from '../models/mapUserLocation.model';
import { IUser } from '../models/user.model';

export interface PlantBrainTrustedAssetScope {
  tenantId: string;
  plantId: string;
  principalId: string;
  assetIds: string[];
  /**
   * K6 v1 requires the sole governed analysis location to equal plantId.
   * Keep the asset's direct location separately for UI/context metadata.
   */
  locationIds: string[];
  assetLocationId: string;
  assetName: string;
  locationName: string;
}

export class PlantBrainScopeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'PlantBrainScopeError';
  }
}

const objectId = (value: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new PlantBrainScopeError(`${label} is invalid`, 422, 'invalid_scope_hint');
  }
  return new mongoose.Types.ObjectId(value);
};

/**
 * Resolves a browser-selected asset into a server-authorized Plant Brain scope.
 *
 * Security boundary:
 * - uiAssetId is an untrusted hint only.
 * - account and user identity come only from the authenticated Express request.
 * - non-admin users must have an explicit asset mapping, matching the current CMMS asset-access model.
 * - plantId is derived from the authoritative location hierarchy, never from the browser or model output.
 * - K6 v1 analysisContext.locationIds is deliberately [plantId]; the asset's direct location is metadata only.
 */
export const resolvePlantBrainTrustedAssetScope = async (
  req: Request,
  uiAssetId: string
): Promise<PlantBrainTrustedAssetScope> => {
  const user = get(req, 'user', {}) as IUser;
  const accountId = user.account_id?.toString();
  const principalId = user._id?.toString();
  const userRole = user.user_role;

  if (!accountId || !principalId || !userRole) {
    throw new PlantBrainScopeError('Authenticated user context is incomplete', 401, 'missing_authenticated_context');
  }

  const accountObjectId = objectId(accountId, 'authenticated account');
  const principalObjectId = objectId(principalId, 'authenticated principal');
  const assetObjectId = objectId(uiAssetId, 'ui_asset_id');
  const asset: any = await AssetModel.findOne({
    _id: assetObjectId,
    account_id: accountObjectId,
    visible: true
  }).lean();

  // Return not-found for both nonexistent and cross-account assets to avoid an asset-enumeration oracle.
  if (!asset) {
    throw new PlantBrainScopeError('Asset is not available', 404, 'asset_not_available');
  }

  if (userRole !== 'admin') {
    const mapping = await MapUserAssetLocationModel.findOne({
      userId: principalObjectId,
      assetId: asset._id
    }).select('_id').lean();
    if (!mapping) {
      throw new PlantBrainScopeError('Asset is not available', 404, 'asset_not_available');
    }
  }

  const location: any = await LocationModel.findOne({
    _id: asset.locationId,
    account_id: accountObjectId,
    visible: true
  }).lean();
  if (!location) {
    throw new PlantBrainScopeError('Asset location context is unavailable', 409, 'location_context_unavailable');
  }

  const rootLocationId = location.top_level
    ? location._id?.toString()
    : location.top_level_location_id?.toString();
  if (!rootLocationId) {
    throw new PlantBrainScopeError('Plant root context is unavailable', 409, 'plant_context_unavailable');
  }

  const rootLocation: any = await LocationModel.findOne({
    _id: objectId(rootLocationId, 'plant root'),
    account_id: accountObjectId,
    visible: true,
    top_level: true
  }).select('_id').lean();
  if (!rootLocation) {
    throw new PlantBrainScopeError('Plant root context is unavailable', 409, 'plant_context_unavailable');
  }

  const assetLocationId = location._id.toString();
  return {
    tenantId: accountId,
    plantId: rootLocationId,
    principalId,
    assetIds: [asset._id.toString()],
    locationIds: [rootLocationId],
    assetLocationId,
    assetName: asset.asset_name || 'Selected asset',
    locationName: location.location_name || ''
  };
};
