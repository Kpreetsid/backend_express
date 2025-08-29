import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";

export const getAllRequests = async (match: any): Promise<IWorkRequest[]> => {
  match.visible = true;
  const populateList = [{ path: "locationId", model: "Schema_Location", select: "id location_name" }, { path: "account_id", model: "Schema_Account", select: "id account_name" }, { path: "createdBy", model: "Schema_User", select: "id firstName lastName" }];
  return await WorkRequestModel.find(match).populate(populateList);
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
  return await WorkRequestModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};