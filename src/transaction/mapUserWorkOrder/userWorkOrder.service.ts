import { WorkOrderAssigneeModel } from "../../models/mapUserWorkOrder.model";
import { WorkOrderModel } from '../../models/workOrder.model';
import { UserModel } from '../../models/user.model';
import { helperService } from '../../utils/helper';

class UserWorkOrderService {
  async mapUsersWorkOrder (body: any, session?: any) {
    const uniqueMappings = Array.from(new Map((body || []).map((mapping: any) => [
      `${String(mapping.woId)}:${String(mapping.userId)}`,
      { woId: mapping.woId, userId: mapping.userId }
    ])).values());
    if (uniqueMappings.length === 0) return [];
    return await WorkOrderAssigneeModel.insertMany(uniqueMappings, { session });
  };

  async getMappedWorkOrderUserIDs (workOrderId: any): Promise<any[]> {
    const assigneeMappings = await WorkOrderAssigneeModel.find({ woId: workOrderId });
    return assigneeMappings.map(item => item.userId);
  };

  async getMappedWorkOrderIDs (user_id: any): Promise<any[]> {
    const assigneeMappings = await WorkOrderAssigneeModel.find({ userId: user_id });
    return [...new Set(assigneeMappings.map(item => item.woId))];
  };

  async updateMappedUsers (id: any, userIdList: any[], session?: any): Promise<any> {
    await WorkOrderAssigneeModel.deleteMany({ woId: id }, { session });
    const newMappings = userIdList.map(userId => ({ userId, woId: id }));
    if (newMappings.length === 0) {
      return [];
    }
    return await WorkOrderAssigneeModel.insertMany(newMappings, { session });
  };

  async assertAccountMappings(workOrderIds: any[], userIds: any[], account_id: any, session?: any): Promise<void> {
    const uniqueOrderIds = Array.from(new Set((workOrderIds || []).map(String).filter(Boolean)));
    const uniqueUserIds = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
    const orderQuery = WorkOrderModel.countDocuments({
      _id: { $in: helperService.validateObjectIds(uniqueOrderIds.join(',')) },
      account_id,
      visible: true
    });
    if (session) orderQuery.session(session);
    if (await orderQuery !== uniqueOrderIds.length) {
      throw Object.assign(new Error('Every work order must belong to the active account'), { status: 404 });
    }

    if (uniqueUserIds.length > 0) {
      const userQuery = UserModel.countDocuments({
        _id: { $in: helperService.validateObjectIds(uniqueUserIds.join(',')) },
        account_id,
        user_status: 'active'
      });
      if (session) userQuery.session(session);
      if (await userQuery !== uniqueUserIds.length) {
        throw Object.assign(new Error('Every assignee must be active and belong to the active account'), { status: 400 });
      }
    }
  }

  async replaceAccountMappedUsers(id: any, userIdList: any[], account_id: any, session?: any): Promise<any> {
    const uniqueUserIds = Array.from(new Set((userIdList || []).map(String).filter(Boolean)));
    await this.assertAccountMappings([id], uniqueUserIds, account_id, session);
    return await this.updateMappedUsers(id, uniqueUserIds, session);
  }

  async removeMappedUsers (id: any, session?: any): Promise<any> {
    return await WorkOrderAssigneeModel.deleteMany({ woId: id }, { session });
  };
  
  async mappedData (match: any): Promise<any> {
    return await WorkOrderAssigneeModel.find(match);
  };
  
  async getAll (match: any): Promise<any> {
    return await WorkOrderAssigneeModel.find(match).populate([{ path: 'woId', model: "Schema_WorkOrder", match: { visible: true } }])
  };
}

export const userWorkOrderService = new UserWorkOrderService();
