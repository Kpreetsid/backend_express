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
