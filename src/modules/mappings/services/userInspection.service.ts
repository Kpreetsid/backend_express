import { MapUserInspectionModel } from "../models/mapUserInspection.model";

class MapInspectionService {
  async getInspectionByUserId (account_id: any, user_id: any) {
    return await MapUserInspectionModel.find({ account_id, user_id, inspection_id: { $exists: true } });
  }
  
  async getUserByInspectionId (account_id: any, inspection_id: any) {
    return await MapUserInspectionModel.find({ account_id, inspection_id, user_id: { $exists: true } });
  }
  
  async setInspection (account_id: any, inspection_id: any, user_id: string[], session?: any) {
    const userIds = Array.from(new Set((user_id || []).map(id => String(id).trim()).filter(Boolean)));
    await this.removeInspectionById(account_id, inspection_id, session);
    if (!userIds.length) return;
    await MapUserInspectionModel.insertMany(userIds.map(userId => ({ account_id, user_id: userId, inspection_id })), { session });
  }
  
  async removeInspectionById (account_id: any, inspection_id: string, session?: any) {
    await MapUserInspectionModel.deleteMany({ inspection_id, account_id, user_id: { $exists: true } }, { session });
  }
  
  async removeInspectionByUserId (account_id: any, user_id: string) {
    await MapUserInspectionModel.deleteMany({ account_id, user_id, inspection_id: { $exists: true } });
  }
}

export const mapInspectionService = new MapInspectionService();
