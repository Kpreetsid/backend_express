import { InspectionModel } from "../models/inspection.model";
import { AssetModel } from "../../assets/models/asset.model";
import { CategoryModel } from "../models/formCategory.model";
import { LocationModel } from "../../locations/models/location.model";
import { MapUserInspectionModel } from "../../mappings/models/mapUserInspection.model";
import { SOPsModel } from "../models/sops.model";
import { UserModel } from "../../users/models/user.model";
import { mapInspectionService } from "../../mappings/services/userInspection.service";
import { withTransaction } from "../../../common/utils/transaction.helper";
import { orderService } from "../../work-orders/services/order.service";

class InspectionService {
 async getAllInspection (filter: any) {
  // ... (aggregate pipeline stays same)
  const data = await InspectionModel.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: MapUserInspectionModel.collection.name, let: { inspId: "$_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$inspection_id", "$$inspId"] } } },
          {
            $lookup: {
              from: UserModel.collection.name, let: { uId: "$user_id" }, pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
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
          { $match: { $expr: { $eq: ["$_id", "$$formId"] }, visible: true } },
          {
            $lookup: {
              from: CategoryModel.collection.name, let: { catId: "$categoryId" }, pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$catId"] }, visible: true } },
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
          { $match: { $expr: { $eq: ["$_id", "$$locId"] }, visible: true } },
          { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } }
        ],
        as: "location_id"
      }
    },
    { $unwind: { path: "$location_id", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: AssetModel.collection.name, let: { assetId: "$asset_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$assetId"] }, visible: true } },
          { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } }
        ],
        as: "asset_id"
    }},
    { $unwind: { path: "$asset_id", preserveNullAndEmptyArrays: true } },
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
    { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } }
  ]);
  return data;
 };

 async createInspection (body: any, account_id: any, user_id: any) {
  return await withTransaction(async (session) => {
    const newInspection = new InspectionModel({
      account_id,
      title: body.title,
      description: body.description,
      start_date: body.start_date,
      form_id: body.form_id,
      inspection_report: body.inspection_report,
      location_id: body.location_id,
      asset_id: body.asset_id,
      assignedUser: body.assignedUser,
      status: body.status,
      month: body.month,
      createdFrom: body.createdFrom,
      no_of_actions: body.no_of_actions,
      createdBy: user_id
    });
    await mapInspectionService.setInspection(account_id, newInspection._id, body.assignedUser, session);
    return await newInspection.save({ session });
  });
 };

 async updateInspection (id: any, body: any, account_id: any, user_id: any) {
  return await withTransaction(async (session) => {
    await mapInspectionService.setInspection(account_id, id, body.assignedUser, session);
    return await InspectionModel.findOneAndUpdate(
      { _id: id, account_id },
      { ...body, updatedBy: user_id },
      { returnDocument: 'after', session }
    );
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

 async createCorrectiveWorkOrder(inspectionId: any, findingKey: string, body: any, user: any) {
  const normalizedFindingKey = String(findingKey || '').trim();
  if (!normalizedFindingKey || normalizedFindingKey.length > 160) {
    throw Object.assign(new Error('A valid inspection finding key is required'), { status: 400 });
  }

  try {
    return await withTransaction(async (session) => {
      const query = InspectionModel.findOne({
        _id: inspectionId,
        account_id: user.account_id,
        visible: true
      });
      const inspection: any = session ? await query.session(session) : await query;
      if (!inspection) {
        throw Object.assign(new Error('Inspection not found'), { status: 404 });
      }

      const actions = Array.isArray(inspection.corrective_actions) ? inspection.corrective_actions : [];
      if (actions.some((action: any) => action?.finding_key === normalizedFindingKey)) {
        throw Object.assign(new Error('A corrective work order already exists for this inspection finding'), { status: 409 });
      }

      const workOrder = await orderService.createWorkOrder({
        title: String(body?.title || `Corrective action - ${inspection.title}`).trim(),
        description: String(body?.description || inspection.description || '').trim(),
        priority: body?.priority || 'Medium',
        status: 'Open',
        type: body?.type || 'Corrective',
        nature_of_work: body?.nature_of_work || 'Corrective',
        createdFrom: 'Inspection',
        wo_location_id: inspection.location_id,
        wo_asset_id: inspection.asset_id,
        start_date: body?.start_date || new Date(),
        end_date: body?.end_date,
        estimated_time: body?.estimated_time,
        tasks: Array.isArray(body?.tasks) ? body.tasks : [],
        parts: Array.isArray(body?.parts) ? body.parts : [],
        procedure_ids: Array.isArray(body?.procedure_ids) ? body.procedure_ids : [],
        userIdList: Array.isArray(body?.userIdList) ? body.userIdList : [],
        files: Array.isArray(body?.files) ? body.files : [],
        source_inspection_id: inspection._id,
        source_finding_key: normalizedFindingKey
      }, user, session);

      if (!workOrder?._id) {
        throw Object.assign(new Error('Corrective work order was not created'), { status: 500 });
      }

      inspection.corrective_actions = [
        ...actions,
        {
          finding_key: normalizedFindingKey,
          work_order_id: workOrder._id,
          order_no: workOrder.order_no,
          createdBy: user._id,
          createdAt: new Date()
        }
      ];
      inspection.no_of_actions = inspection.corrective_actions.length;
      inspection.updatedBy = user._id;
      await inspection.save({ session });
      return workOrder;
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw Object.assign(new Error('A corrective work order already exists for this inspection finding'), { status: 409 });
    }
    throw error;
  }
 }

}

export const inspectionService = new InspectionService();