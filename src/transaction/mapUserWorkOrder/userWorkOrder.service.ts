import { WorkOrderAssigneeModel } from "../../models/mapUserWorkOrder.model";

class UserWorkOrderService {
  async mapUsersWorkOrder (body: any, session?: any) {
    return await WorkOrderAssigneeModel.insertMany(body, { session });
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
