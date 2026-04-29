import { PartsTypeModel } from "../../models/parts-types.model";

class PartsTypeService {
  async getPartTypes(match: any) {
    return await PartsTypeModel.aggregate([
      { $match: match },
      {
      $lookup: {
        from: "users", let: { uId: "$createdBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1, user_role: 1, email: 1, user_status: 1 } }
        ],
        as: "createdBy"
      }
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users", let: { uId: "$updatedBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1, user_role: 1, email: 1, user_status: 1 } }
        ],
        as: "updatedBy"
      }
    },
    { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },
    { $addFields: { id: "$_id" } }
    ]);
  }

  async createPartType(data: any) {
    const newPartType = new PartsTypeModel(data);
    return await newPartType.save();
  }

  async updatePartType(id: any, data: any, userId: any) {
    return await PartsTypeModel.findByIdAndUpdate(id, { ...data, updatedBy: userId }, { new: true });
  }

  async removePartType(id: any, userId: any) {
    return await PartsTypeModel.findByIdAndUpdate(id, { visible: false, updatedBy: userId }, { new: true });
  }
}

export const partsTypeService = new PartsTypeService();