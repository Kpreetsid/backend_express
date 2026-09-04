import { PartsTypeModel } from "../models/parts-types.model";
import { UserModel } from "../../users/models/user.model";
import { sanitizePartTypePayload } from "../policies/part-type.policy";
import { PartsModel } from "../models/part.model";

class PartsTypeService {
  async getPartTypes(match: any) {
    return await PartsTypeModel.aggregate([
      { $match: match },
      {
      $lookup: {
        from: UserModel.collection.name, let: { uId: "$createdBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1, user_role: 1, email: 1, user_status: 1 } }
        ],
        as: "createdBy"
      }
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: UserModel.collection.name, let: { uId: "$updatedBy" }, pipeline: [
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

  async createPartType(data: any, accountId: any, userId: any) {
    const payload = sanitizePartTypePayload(data);
    this.assertValidPayload(payload);
    const duplicate = await PartsTypeModel.exists({
      account_id: accountId,
      visible: true,
      name: { $regex: `^${this.escapeRegex(String(payload.name || '').trim())}$`, $options: 'i' }
    });
    if (duplicate) {
      throw Object.assign(new Error('A part type with this name already exists'), { status: 409 });
    }
    const newPartType = new PartsTypeModel({ ...payload, account_id: accountId, createdBy: userId, visible: true });
    return await newPartType.save();
  }

  async updatePartType(id: any, data: any, userId: any, accountId: any) {
    const payload = sanitizePartTypePayload(data);
    this.assertValidPayload(payload);
    const duplicate = await PartsTypeModel.exists({
      _id: { $ne: id },
      account_id: accountId,
      visible: true,
      name: { $regex: `^${this.escapeRegex(String(payload.name || '').trim())}$`, $options: 'i' }
    });
    if (duplicate) {
      throw Object.assign(new Error('A part type with this name already exists'), { status: 409 });
    }
    return await PartsTypeModel.findOneAndUpdate(
      { _id: id, account_id: accountId, visible: true },
      { $set: { ...payload, updatedBy: userId } },
      { returnDocument: 'after' }
    );
  }

  async removePartType(id: any, userId: any, accountId: any) {
    if (await PartsModel.exists({ account_id: accountId, visible: true, part_type: id })) {
      throw Object.assign(new Error('This part type is assigned to an active part and cannot be deleted'), { status: 409 });
    }
    return await PartsTypeModel.findOneAndUpdate(
      { _id: id, account_id: accountId, visible: true },
      { $set: { visible: false, updatedBy: userId } },
      { returnDocument: 'after' }
    );
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private assertValidPayload(payload: any): void {
    const name = String(payload?.name || '').trim();
    if (!name) {
      throw Object.assign(new Error('Part type name is required'), { status: 400 });
    }
    if (name.length > 120 || String(payload?.description || '').length > 1000) {
      throw Object.assign(new Error('Part type details exceed the allowed length'), { status: 400 });
    }
  }
}

export const partsTypeService = new PartsTypeService();
