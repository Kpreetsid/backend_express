import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";

export const getAllRequests = async (match: any): Promise<IWorkRequest[]> => {
  match.visible = true;
  const populateList = [
    { path: "location_id", model: "Schema_Location", select: "id location_name location_type" },
    { path: "asset_id", model: "Schema_Asset", select: "id asset_name asset_type" },
    { path: "account_id", model: "Schema_Account", select: "id account_name" },
    { path: "createdBy", model: "Schema_User", select: "id firstName lastName" },
    { path: "updatedBy", model: "Schema_User", select: "id firstName lastName" }
  ];
  return await WorkRequestModel.find(match).populate(populateList);
};

export const getRequestById = async (id: string): Promise<IWorkRequest | null> => {
  return await WorkRequestModel.findById(id);
}

export const createRequest = async (body: any, user: any): Promise<any> => {
  const newWorkRequest = new WorkRequestModel({
    account_id: user.account_id,
    title: body.title,
    description: body.description,
    problemType: body.problemType,
    priority: body.priority,
    location_id: body.location_id,
    asset_id: body.asset_id,
    files: body.files,
    status: body.status,
    tags: body.tags,
    createdBy: user._id
  });
  return await newWorkRequest.save();
};

export const updateRequest = async (id: string, body: any, user_id: any): Promise<any> => {
  body.updatedBy = user_id;
  return await WorkRequestModel.updateOne({ _id: id }, body);
};

export const deleteRequestById = async (id: any, user_id: any): Promise<any> => {
  return await WorkRequestModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};