import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";

export const getAllRequests = async (match: any): Promise<IWorkRequest[]> => {
  match.visible = true;
  return await WorkRequestModel.find(match)
};

export const getRequestById = async (id: string): Promise<IWorkRequest | null> => {
  return await WorkRequestModel.findById(id);
}

export const createRequest = async (body: any, account_id: any, user_id: any): Promise<any> => {
    const newWorkRequest = new WorkRequestModel({
      ...body,
      account_id,
      createdBy: user_id
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