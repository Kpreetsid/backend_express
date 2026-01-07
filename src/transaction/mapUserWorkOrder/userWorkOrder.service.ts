import { WorkOrderAssigneeModel } from "../../models/mapUserWorkOrder.model";

class UserWorkOrderService {
  async mapUsersWorkOrder (body: any) {
    return await WorkOrderAssigneeModel.insertMany(body);
  };

  async getMappedWorkOrderUserIDs (workOrderId: any): Promise<any[]> {
    const assigneeMappings = await WorkOrderAssigneeModel.find({ woId: workOrderId });
    return assigneeMappings.map(item => item.userId);
  };

  async getMappedWorkOrderIDs (user_id: any): Promise<any[]> {
    const assigneeMappings = await WorkOrderAssigneeModel.find({ userId: user_id });
    return [...new Set(assigneeMappings.map(item => item.woId))];
  };

  async updateMappedUsers (id: any, userIdList: any[]): Promise<any> {
    await WorkOrderAssigneeModel.deleteMany({ woId: id });
    const newMappings = userIdList.map(userId => ({ userId, woId: id }));
    return await WorkOrderAssigneeModel.insertMany(newMappings);
  };

  async removeMappedUsers (id: any): Promise<any> {
    return await WorkOrderAssigneeModel.deleteMany({ woId: id });
  };
  
  async mappedData (match: any): Promise<any> {
    return await WorkOrderAssigneeModel.find(match);
  };
  
  async getAll (match: any): Promise<any> {
    return await WorkOrderAssigneeModel.find(match).populate([{ path: 'woId', model: "Schema_WorkOrder" }])
  };
}

export const userWorkOrderService = new UserWorkOrderService();