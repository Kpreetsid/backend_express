import { UserLogModel } from "../models/userLogs.model";

class UserLogsService {
  async getAllUserLogs (match: any): Promise<any> {
    return await UserLogModel.find(match).sort({_id: -1}).limit(500);
  };
}

export const userLogsService = new UserLogsService();
