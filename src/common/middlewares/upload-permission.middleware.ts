import { NextFunction, Request, Response } from 'express';
import { accountAccessService } from '@modules/users/services/account-access.service';

type UploadRoleAction = { module: string; action: string };
type UploadPermissionPolicy = {
  featureKeys: string[];
  roleAny: UploadRoleAction[];
};

const UPLOAD_PERMISSION_REGISTRY: Record<string, UploadPermissionPolicy> = {
  assets: {
    featureKeys: ['asset'],
    roleAny: [{ module: 'asset', action: 'add_asset' }, { module: 'asset', action: 'edit_asset' }]
  },
  asset_report: {
    featureKeys: ['report_asset'],
    roleAny: [{ module: 'asset', action: 'create_report' }, { module: 'asset', action: 'edit_report' }]
  },
  endpointImages: {
    featureKeys: ['endpoint'],
    roleAny: [{ module: 'asset', action: 'create_endpoint' }, { module: 'asset', action: 'edit_endpoint' }]
  },
  floor_map: {
    featureKeys: ['floor_map', 'location_floor_map'],
    roleAny: [{ module: 'floorMap', action: 'create_kpi' }, { module: 'floorMap', action: 'upload_floor_map' }]
  },
  locations: {
    featureKeys: ['location'],
    roleAny: [{ module: 'location', action: 'add_location' }, { module: 'location', action: 'edit_location' }]
  },
  logo: {
    featureKeys: ['master_admin_panel'],
    roleAny: [{ module: 'admin_panel', action: 'edit' }]
  },
  mailers: {
    featureKeys: ['asset_mail'],
    roleAny: [{ module: 'asset_mail', action: 'add' }, { module: 'asset_mail', action: 'edit' }]
  },
  observations: {
    featureKeys: ['observation'],
    roleAny: [{ module: 'asset', action: 'add_observation' }, { module: 'asset', action: 'edit_observation' }]
  },
  posts: {
    featureKeys: ['posts'],
    roleAny: [{ module: 'posts', action: 'add' }, { module: 'posts', action: 'edit' }]
  },
  WO_docs: {
    featureKeys: ['work_order'],
    roleAny: [{ module: 'workOrder', action: 'create_work_order' }, { module: 'workOrder', action: 'edit_work_order' }]
  },
  work_order: {
    featureKeys: ['work_order'],
    roleAny: [{ module: 'workOrder', action: 'create_work_order' }, { module: 'workOrder', action: 'edit_work_order' }]
  },
  work_request: {
    featureKeys: ['work_request'],
    roleAny: [{ module: 'work_request', action: 'add' }, { module: 'work_request', action: 'edit' }]
  }
};

const ALWAYS_AVAILABLE_UPLOADS = new Set(['user_profile_img']);

const hasUploadAction = (role: any, roleAny: UploadRoleAction[]): boolean =>
  roleAny.some(({ module, action }) => role?.[module]?.[action] === true);

export const enforceUploadPermission = (req: Request, res: Response, next: NextFunction): void | Response => {
  const folderName = String(req.params?.folderName || req.body?.folderName || '').trim();
  if (!folderName) {
    return res.status(400).json({
      status: false,
      code: 'UPLOAD_CONTEXT_REQUIRED',
      message: 'A configured upload context is required.'
    });
  }

  if (ALWAYS_AVAILABLE_UPLOADS.has(folderName)) {
    return next();
  }

  const policy = UPLOAD_PERMISSION_REGISTRY[folderName];
  if (!policy) {
    return res.status(400).json({
      status: false,
      code: 'UNKNOWN_UPLOAD_CONTEXT',
      message: 'The upload context is not configured.'
    });
  }

  const roleMenu = (req as any).roleMenu || {};
  const accountAllowed = policy.featureKeys.some(featureKey =>
    accountAccessService.isEffectivePermissionEnabled(roleMenu, featureKey, 'view')
  );
  if (!accountAllowed) {
    return res.status(403).json({
      status: false,
      code: 'ACCOUNT_FEATURE_DISABLED',
      message: 'This feature is disabled for the account.',
      featureKey: policy.featureKeys.join('|'),
      action: 'view',
      accountPermissionVersion: Number((req as any).accountPermissionVersion || 0)
    });
  }

  const role = (req as any).role || {};
  if (!hasUploadAction(role, policy.roleAny)) {
    return res.status(403).json({
      status: false,
      code: 'USER_PERMISSION_DENIED',
      message: 'You do not have permission to upload files in this context.'
    });
  }

  return next();
};
