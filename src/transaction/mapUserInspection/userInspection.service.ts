import { MapUserInspectionModel } from "../../models/mapUserInspection.model";

export const getInspectionByUserId = async (account_id: any, user_id: any) => {
  return await MapUserInspectionModel.find({ account_id, user_id, inspection_id: { $exists: true } });
}

export const getUserByInspectionId = async (account_id: any, inspection_id: any) => {
  return await MapUserInspectionModel.find({ account_id, inspection_id, user_id: { $exists: true } });
}

export const setInspection = async (account_id: any, inspection_id: any, user_id: string[]) => {
  await MapUserInspectionModel.deleteMany({ inspection_id, account_id, user_id: { $nin: user_id } });
  await MapUserInspectionModel.insertMany(user_id.map(userId => ({ account_id, userId, inspection_id })));
}

export const removeInspectionById = async (account_id: any, inspection_id: string) => {
  await MapUserInspectionModel.deleteMany({ inspection_id, account_id, user_id: { $exists: true } });
}

export const removeInspectionByUserId = async (account_id: any, user_id: string) => {
  await MapUserInspectionModel.deleteMany({ account_id, user_id, inspection_id: { $exists: true } });
}