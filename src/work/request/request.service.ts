import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";

export const getAllRequests = async (match: any): Promise<IWorkRequest[]> => {
  match.isActive = true;
  return await WorkRequestModel.find(match)
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