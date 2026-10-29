const USER_UPDATE_FIELDS = new Set([
  'firstName',
  'lastName',
  'username',
  'email',
  'user_status',
  'user_role',
  'phone_no',
  'user_profile_img',
  'isTourCompleted'
]);

const USER_CREATE_FIELDS = new Set([
  ...USER_UPDATE_FIELDS,
  'password'
]);

const pick = (payload: Record<string, any>, allowed: Set<string>): Record<string, any> =>
  Object.fromEntries(Object.entries(payload || {}).filter(([key]) => allowed.has(key)));

export const pickUserUpdateFields = (payload: Record<string, any> = {}): Record<string, any> =>
  pick(payload, USER_UPDATE_FIELDS);

export const pickUserCreateFields = (payload: Record<string, any> = {}): Record<string, any> =>
  pick(payload, USER_CREATE_FIELDS);

export const buildUserAccountFilter = (userId: any, accountId: any) => ({
  _id: userId,
  account_id: accountId,
  visible: { $ne: false }
});


export const buildLocationAccountFilter = (locationId: any, accountId: any) => ({
  _id: locationId,
  account_id: accountId,
  visible: { $ne: false }
});

export const buildMappedUserFilter = (userIds: any[], accountId: any) => ({
  _id: { $in: userIds },
  account_id: accountId,
  visible: { $ne: false }
});


const MANAGER_ASSIGNABLE_ROLES = new Set(['employee', 'customer', 'user']);

export const canAssignUserRole = (
  actorRole: string | undefined,
  requestedRole: string | undefined,
  existingTargetRole?: string
): boolean => {
  if (!requestedRole) return true;
  if (actorRole === 'admin') return true;
  if (actorRole !== 'manager') return false;
  if (existingTargetRole && !MANAGER_ASSIGNABLE_ROLES.has(existingTargetRole)) return false;
  return MANAGER_ASSIGNABLE_ROLES.has(requestedRole);
};

export const shouldRevokeUserSessionsAfterUpdate = (
  existing: Partial<Record<'user_role' | 'user_status' | 'email' | 'username', any>> = {},
  updates: Partial<Record<'user_role' | 'user_status' | 'email' | 'username', any>> = {}
): boolean => ['user_role', 'user_status', 'email', 'username'].some(
  (key) => updates[key] !== undefined && String(updates[key]) !== String(existing[key])
);
