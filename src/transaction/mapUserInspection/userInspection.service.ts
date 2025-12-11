import { MapUserInspectionModel } from "../../models/mapUserInspection.model";

class MapInspectionService {
  async getInspectionByUserId (account_id: any, user_id: any) {
    return await MapUserInspectionModel.find({ account_id, user_id, inspection_id: { $exists: true } });
  }
  
  async getUserByInspectionId (account_id: any, inspection_id: any) {
    return await MapUserInspectionModel.find({ account_id, inspection_id, user_id: { $exists: true } });
  }
  
  async setInspection (account_id: any, inspection_id: any, user_id: string[]) {
    await this.removeInspectionById(account_id, inspection_id);
    await MapUserInspectionModel.insertMany(user_id.map(userId => ({ account_id, user_id: userId, inspection_id })));
  }
  
  async removeInspectionById (account_id: any, inspection_id: string) {
    await MapUserInspectionModel.deleteMany({ inspection_id, account_id, user_id: { $exists: true } });
  }
  
  async removeInspectionByUserId (account_id: any, user_id: string) {
    await MapUserInspectionModel.deleteMany({ account_id, user_id, inspection_id: { $exists: true } });
  }
}

export const mapInspectionService = new MapInspectionService();