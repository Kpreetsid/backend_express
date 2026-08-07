import { ClientSession, Types } from 'mongoose';
import { UserModel } from '../models/user.model';

export const requireActiveTenantUsers = async (
  userIds: Array<string | Types.ObjectId>,
  accountId: string | Types.ObjectId,
  session?: ClientSession
): Promise<Types.ObjectId[]> => {
  const uniqueUserIds = [...new Set(userIds.map(String))]
    .map((id) => new Types.ObjectId(id));
  if (uniqueUserIds.length === 0) {
    throw Object.assign(new Error('At least one active account user is required'), { status: 400 });
  }

  const query = UserModel.countDocuments({
    _id: { $in: uniqueUserIds },
    account_id: accountId,
    user_status: 'active'
  });
  if (session) query.session(session);
  const tenantUserCount = await query;
  if (tenantUserCount !== uniqueUserIds.length) {
    throw Object.assign(new Error('One or more users were not found in this account'), { status: 404 });
  }
  return uniqueUserIds;
};
