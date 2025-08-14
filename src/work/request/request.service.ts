import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";

export const getAllRequests = async (match: any): Promise<IWorkRequest[]> => {
  match.isActive = true;
  return await WorkRequestModel.aggregate([
    { $match: match },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user_details" }},
    { $unwind: { path: "$user_details", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "account_master", localField: "account_id", foreignField: "_id", as: "account" }}, 
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "asset_master", localField: "assetId", foreignField: "_id", as: "asset" }}, 
    { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "location_master", localField: "locationId", foreignField: "_id", as: "location" }}, 
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
    { $addFields: { id: '$_id' } }
  ]);
};

export const getRequestById = async (id: string): Promise<IWorkRequest | null> => {
  return await WorkRequestModel.findById(id);
}

export const createRequest = async (body: any, user: any): Promise<any> => {
  const newWorkRequest = new WorkRequestModel({
    ...body,
    account_id: user.account_id,
    emailId: user.email,
    userId: user._id,
    createdBy: user._id
  });
  return await newWorkRequest.save();
};

export const updateRequest = async (id: any, body: any, user_id: any): Promise<any> => {
  body.updatedBy = user_id;
  return await WorkRequestModel.findByIdAndUpdate(id, body);
};

export const deleteRequestById = async (id: any, user_id: any): Promise<any> => {
  return await WorkRequestModel.findByIdAndUpdate(id, { updatedBy: user_id, isActive: false }, { new: true });
};