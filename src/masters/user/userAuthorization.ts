import { Request } from 'express';
import { AccountAction, accountAccessService } from '../../_role/accountAccess.service';

const forbidden = () => Object.assign(new Error('You do not have permission to make this user change.'), { status: 403 });
const PROFILE_FIELDS = ['firstName', 'lastName', 'username', 'email', 'phone_no', 'user_profile_img', 'isTourCompleted'] as const;
const ADMIN_FIELDS = ['user_role', 'user_status', 'isVerified'] as const;
const IMMUTABLE_FIELDS = ['_id', 'id', 'account_id', 'isFirstUser', 'password', 'createdBy', 'updatedBy', 'passwordExpiredAt', 'createdAt', 'updatedAt', 'visible', '__v'] as const;

export const hasUserManagementPermission = (req: Request, action: AccountAction): boolean =>
  accountAccessService.isEffectivePermissionEnabled((req as any).roleMenu || {}, 'users', action);

export const requireUserManagementPermission = (req: Request, action: AccountAction): void => {
  if (!hasUserManagementPermission(req, action)) throw forbidden();
};

export const requireRoleManagementPermission = (req: Request, action: AccountAction): void => {
  if (!accountAccessService.isEffectivePermissionEnabled((req as any).roleMenu || {}, 'permission', action)) {
    throw forbidden();
  }
};

// Reject alternate Mongo/update encodings even when this helper is called without
// the HTTP sanitizer. Nested profile objects must not carry update operators.
const assertPlainFields = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) throw forbidden();
    assertPlainFields(nested);
  }
};

const sameValue = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left == null || right == null || typeof left === 'boolean' || typeof right === 'boolean') return false;
  if (left instanceof Date || right instanceof Date) {
    return new Date(left as string).getTime() === new Date(right as string).getTime();
  }
  return String(left) === String(right);
};

export const userUpdateFields = (req: Request, existing: any): Record<string, unknown> => {
  const body = req.body || {};
  assertPlainFields(body);
  const canAdminister = (req as any).user?.user_role === 'admin' && hasUserManagementPermission(req, 'edit');
  for (const field of IMMUTABLE_FIELDS) {
    const stored = field === 'id' ? existing._id : existing[field];
    if (body[field] !== undefined && !sameValue(body[field], stored)) throw forbidden();
  }
  const result: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) if (body[field] !== undefined) result[field] = body[field];
  for (const field of ADMIN_FIELDS) {
    if (body[field] === undefined) continue;
    if (!canAdminister) {
      if (!sameValue(body[field], existing[field])) throw forbidden();
      continue;
    }
    if (field === 'isVerified' && typeof body[field] !== 'boolean') throw forbidden();
    if (field === 'user_role' && !['admin', 'manager', 'employee', 'customer', 'user'].includes(body[field])) throw forbidden();
    if (field === 'user_status' && !['active', 'inactive'].includes(body[field])) throw forbidden();
    result[field] = body[field];
  }
  return result;
};

export const userCreateFields = (req: Request): Record<string, unknown> => {
  const body = req.body || {};
  assertPlainFields(body);
  const caller = (req as any).user;
  for (const field of IMMUTABLE_FIELDS) {
    if (field === 'password') continue;
    const allowed = field === 'account_id' ? caller.account_id : field === 'createdBy' ? caller._id : field === 'isFirstUser' ? false : undefined;
    if (body[field] !== undefined && !sameValue(body[field], allowed)) throw forbidden();
  }
  if (body.isVerified !== undefined && body.isVerified !== false) throw forbidden();
  if (body.user_role === 'admin' && caller.user_role !== 'admin') throw forbidden();
  const result: Record<string, unknown> = {};
  for (const field of [...PROFILE_FIELDS, 'user_role', 'user_status', 'password']) if (body[field] !== undefined) result[field] = body[field];
  return { ...result, account_id: caller.account_id, createdBy: caller._id, isFirstUser: false, isVerified: false };
};
