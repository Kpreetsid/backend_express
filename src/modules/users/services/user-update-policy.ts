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

export const pickUserUpdateFields = (payload: Record<string, any> = {}): Record<string, any> =>
  Object.fromEntries(Object.entries(payload).filter(([key]) => USER_UPDATE_FIELDS.has(key)));

export const buildUserAccountFilter = (userId: any, accountId: any) => ({
  _id: userId,
  account_id: accountId,
  visible: { $ne: false }
});
