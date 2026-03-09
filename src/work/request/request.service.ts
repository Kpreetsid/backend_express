import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";

class RequestService {

  async getAllRequests (match: any): Promise<IWorkRequest[]> {
    match.visible = true;
    const populateList = [
      { path: "location_id", model: "Schema_Location", select: "id location_name location_type top_level parent_id visible", match: { visible: true } },
      { path: "asset_id", model: "Schema_Asset", select: "id asset_name asset_type asset_model top_level parent_id visible", match: { visible: true } },
      { path: "account_id", model: "Schema_Account", select: "id account_name" },
      { path: "createdBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" },
      { path: "updatedBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" }
    ];
    return await WorkRequestModel.find(match).populate(populateList);
  };
  
  async getRequestById (id: string): Promise<IWorkRequest | null> {
    return await WorkRequestModel.findById(id);
  }
  
  async createRequest (body: any, user: any): Promise<any> {
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
  
  async updateRequest (id: string, body: any, user_id: any): Promise<any> {
    body.updatedBy = user_id;
    return await WorkRequestModel.updateOne({ _id: id }, body);
  };
  
  async deleteRequestById (id: any, user_id: any): Promise<any> {
    return await WorkRequestModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
  };
}

export const requestService = new RequestService();