import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser, USER_ROLES } from '../../users/models/user.model';
import { AssetModel } from '../../assets/models/asset.model';
import { LocationModel } from '../../locations/models/location.model';
import { applyRoleFilter } from '../../../common/utils/role-filter.helper';

export interface GuideContext {
  field: 'assetId' | 'locationId';
  id: string;
  module: 'asset' | 'location';
  editAction: 'edit_asset' | 'edit_location';
}

const referenceId = (value: any): string => String(value?._id ?? value?.id ?? value ?? '');

export const getGuideContext = (value: any): GuideContext => {
  const assetId = referenceId(value?.assetId);
  const locationId = referenceId(value?.locationId);
  if ((assetId ? 1 : 0) + (locationId ? 1 : 0) !== 1) {
    throw Object.assign(new Error('Exactly one asset or location is required'), { status: 400 });
  }
  const id = assetId || locationId;
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw Object.assign(new Error(`Invalid ${assetId ? 'asset' : 'location'} ID`), { status: 400 });
  }
  return assetId
    ? { field: 'assetId', id, module: 'asset', editAction: 'edit_asset' }
    : { field: 'locationId', id, module: 'location', editAction: 'edit_location' };
};

export const assertGuideMutationPermission = (req: Request, value: any): GuideContext => {
  const context = getGuideContext(value);
  const user = get(req, 'user', {}) as IUser;
  const roleMenu: any = get(req, 'role', {});
  if (!user?.user_role || !USER_ROLES.includes(user.user_role) ||
      roleMenu?.[context.module]?.[context.editAction] !== true) {
    throw Object.assign(new Error('You do not have permission to access.'), { status: 403 });
  }
  return context;
};

export const hasGuideMutationPermission = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    assertGuideMutationPermission(req, req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const assertGuideTargetAccessible = async (user: IUser, value: any): Promise<GuideContext> => {
  const context = getGuideContext(value);
  const baseFilter = { _id: context.id, account_id: user.account_id, visible: true };
  const filter = await applyRoleFilter({
    user,
    baseFilter,
    mapping: context.module,
    idField: '_id'
  });
  const model: any = context.module === 'asset' ? AssetModel : LocationModel;
  const exists = await model.exists(filter);
  if (!exists) {
    throw Object.assign(new Error(`${context.module === 'asset' ? 'Asset' : 'Location'} not found`), { status: 404 });
  }
  return context;
};

export const assertSameGuideContext = (existing: any, update: any): void => {
  const current = getGuideContext(existing);
  const requested = getGuideContext(update);
  if (current.field !== requested.field || current.id !== requested.id) {
    throw Object.assign(new Error('A guide cannot be moved to another asset or location'), { status: 400 });
  }
};
