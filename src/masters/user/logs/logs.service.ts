import { UserLogModel } from "../../../models/userLogs.model";

export const getAllUserLogs = async (match: any): Promise<any> => {
  return await UserLogModel.find(match).sort({_id: -1});
};