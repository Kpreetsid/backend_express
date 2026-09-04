import { InspectionModel } from "../models/inspection.model";
import { AssetModel } from "../../assets/models/asset.model";
import { CategoryModel } from "../models/formCategory.model";
import { LocationModel } from "../../locations/models/location.model";
import { MapUserInspectionModel } from "../../mappings/models/mapUserInspection.model";
import { SOPsModel } from "../models/sops.model";
import { UserModel } from "../../users/models/user.model";
import { mapInspectionService } from "../../mappings/services/userInspection.service";
import { withTransaction } from "../../../common/utils/transaction.helper";
import { sanitizeInspectionPayload } from '../policies/inspection.policy';

class InspectionService {
 async getAllInspection (filter: any) {
  // ... (aggregate pipeline stays same)
  const data = await InspectionModel.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: MapUserInspectionModel.collection.name, let: { inspId: "$_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$inspection_id", "$$inspId"] }, account_id: filter.account_id } },
          {
            $lookup: {
              from: UserModel.collection.name, let: { uId: "$user_id" }, pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$uId"] }, account_id: filter.account_id } },
                { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1, user_role: 1, email: 1, user_status: 1 } }
              ],
              as: "assignedUser"
            }
          },
          { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } }
        ],
        as: "assignedUsers"
      }
    },
    {
      $lookup: {
        from: SOPsModel.collection.name, let: { formId: "$form_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$formId"] }, account_id: filter.account_id, visible: true } },
          {
            $lookup: {
              from: CategoryModel.collection.name, let: { catId: "$categoryId" }, pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$catId"] }, account_id: filter.account_id, visible: true } },
                { $project: { _id: 1, id: "$_id", name: 1, visible: 1 } }
              ],
              as: "categoryId"
            }
          }
        ],
        as: "form_id"
      }
    },
    { $unwind: { path: "$form_id", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: LocationModel.collection.name, let: { locId: "$location_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$locId"] }, account_id: filter.account_id, visible: true } },
          { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } }
        ],
        as: "location_id"
      }
    },
    { $unwind: { path: "$location_id", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: AssetModel.collection.name, let: { assetId: "$asset_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$assetId"] }, account_id: filter.account_id, visible: true } },
          { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } }
        ],
        as: "asset_id"
    }},
    { $unwind: { path: "$asset_id", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: UserModel.collection.name, let: { uId: "$createdBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] }, account_id: filter.account_id } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1, user_role: 1, email: 1, user_status: 1 } }
        ],
        as: "createdBy"
      }
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: UserModel.collection.name, let: { uId: "$updatedBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] }, account_id: filter.account_id } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1, user_role: 1, email: 1, user_status: 1 } }
        ],
        as: "updatedBy"
      }
    },
    { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } }
  ]);
  return data;
 };

 async createInspection (body: any, account_id: any, user_id: any) {
  const payload = sanitizeInspectionPayload(body);
  await this.assertReferences(payload, account_id);
  return await withTransaction(async (session) => {
    const newInspection = new InspectionModel({
      account_id,
      ...payload,
      createdBy: user_id
    });
    await mapInspectionService.setInspection(account_id, newInspection._id, payload.assignedUser, session);
    return await newInspection.save({ session });
  });
 };

 async updateInspection (id: any, body: any, account_id: any, user_id: any) {
  const [existing, existingMappings] = await Promise.all([
    InspectionModel.findOne({ _id: id, account_id, visible: true }).lean(),
    mapInspectionService.getUserByInspectionId(account_id, id)
  ]);
  if (!existing) return null;
  const payload = sanitizeInspectionPayload({
    title: body.title !== undefined ? body.title : existing.title,
    description: body.description !== undefined ? body.description : existing.description,
    start_date: body.start_date !== undefined ? body.start_date : existing.start_date,
    form_id: body.form_id !== undefined ? body.form_id : existing.form_id,
    inspection_report: body.inspection_report !== undefined ? body.inspection_report : existing.inspection_report,
    location_id: body.location_id !== undefined ? body.location_id : existing.location_id,
    asset_id: body.asset_id !== undefined ? body.asset_id : existing.asset_id,
    assignedUser: body.assignedUser !== undefined ? body.assignedUser : existingMappings.map((mapping: any) => mapping.user_id),
    status: body.status !== undefined ? body.status : existing.status,
    month: body.month !== undefined ? body.month : existing.month,
    createdFrom: body.createdFrom !== undefined ? body.createdFrom : existing.createdFrom,
    no_of_actions: body.no_of_actions !== undefined ? body.no_of_actions : existing.no_of_actions
  });
  await this.assertReferences(payload, account_id);
  return await withTransaction(async (session) => {
    const updated = await InspectionModel.findOneAndUpdate(
      { _id: id, account_id, visible: true },
      { $set: { ...payload, updatedBy: user_id } },
      { returnDocument: 'after', session, runValidators: true }
    );
    if (updated) {
      await mapInspectionService.setInspection(account_id, id, payload.assignedUser, session);
    }
    return updated;
  });
 };

 async removeInspection (id: any, account_id: any, user_id: any) {
  return await withTransaction(async (session) => {
    await mapInspectionService.removeInspectionById(account_id, id, session);
    return await InspectionModel.findOneAndUpdate(
      { _id: id, account_id },
      { visible: false, updatedBy: user_id },
      { returnDocument: 'after', session }
    );
  });
 };

 private async assertReferences(payload: any, account_id: any): Promise<void> {
  const [location, asset, form, assignedUserCount] = await Promise.all([
    LocationModel.exists({ _id: payload.location_id, account_id, visible: true }),
    AssetModel.findOne({ _id: payload.asset_id, account_id, visible: true }, { locationId: 1 }).lean(),
    SOPsModel.findOne({ _id: payload.form_id, account_id, visible: true }, { locationId: 1 }).lean(),
    payload.assignedUser.length
      ? UserModel.countDocuments({
          _id: { $in: payload.assignedUser },
          account_id,
          user_status: 'active'
        })
      : Promise.resolve(0)
  ]);
  if (!location) {
    throw Object.assign(new Error('Location is not available in this account'), { status: 400 });
  }
  if (!asset) {
    throw Object.assign(new Error('Asset is not available in this account'), { status: 400 });
  }
  if (!form) {
    throw Object.assign(new Error('Form is not available in this account'), { status: 400 });
  }
  if (String(asset.locationId || '') !== String(payload.location_id)) {
    throw Object.assign(new Error('Asset does not belong to the selected location'), { status: 400 });
  }
  if (String(form.locationId || '') !== String(payload.location_id)) {
    throw Object.assign(new Error('Form does not belong to the selected location'), { status: 400 });
  }
  if (assignedUserCount !== payload.assignedUser.length) {
    throw Object.assign(new Error('One or more assigned users are not active in this account'), { status: 400 });
  }
 }
}

export const inspectionService = new InspectionService();
