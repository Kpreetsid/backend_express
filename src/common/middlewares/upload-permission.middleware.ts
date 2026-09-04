import { NextFunction, Request, Response } from 'express';
import { accountAccessService } from '../../modules/users/services/account-access.service';

const UPLOAD_PERMISSION_REGISTRY: Record<string, string[]> = {
  assets: ['asset'],
  asset_report: ['report_asset'],
  endpointImages: ['endpoint'],
  floor_map: ['floor_map', 'location_floor_map'],
  locations: ['location'],
  mailers: ['asset_mail'],
  observations: ['observation'],
  posts: ['posts'],
  WO_docs: ['work_order'],
  work_order: ['work_order'],
  work_request: ['work_request'],
};

const ALWAYS_AVAILABLE_UPLOADS = new Set(['user_profile_img']);

export const enforceUploadPermission = (req: Request, res: Response, next: NextFunction): void | Response => {
  const folderName = String(req.params.folderName || req.body?.folderName || '').trim();
  if (!folderName || ALWAYS_AVAILABLE_UPLOADS.has(folderName)) {
    return next();
  }

  const featureKeys = UPLOAD_PERMISSION_REGISTRY[folderName];
  if (!featureKeys) {
    return res.status(400).json({
      status: false,
      code: 'UNKNOWN_UPLOAD_CONTEXT',
      message: 'The upload context is not configured.',
    });
  }

  const roleMenu = (req as any).roleMenu || {};
  const allowed = featureKeys.some(featureKey =>
    accountAccessService.isEffectivePermissionEnabled(roleMenu, featureKey, 'view')
  );
  if (allowed) {
    return next();
  }

  return res.status(403).json({
    status: false,
    code: 'ACCOUNT_FEATURE_DISABLED',
    message: 'This feature is disabled for the account.',
    featureKey: featureKeys.join('|'),
    action: 'view',
    accountPermissionVersion: Number((req as any).accountPermissionVersion || 0),
  });
};
