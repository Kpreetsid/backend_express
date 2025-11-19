import { InspectionModel } from "../models/inspection.model";
import { setInspection, removeInspectionById } from "../transaction/mapUserInspection/userInspection.service";
import mongoose from "mongoose";

export const getAllInspection = async (filter: any, userRole?: string, user_id?: string) => {

  const match: any = { ...filter };

  // If user is NOT admin → only show inspections mapped to that user
  if (userRole !== "admin") {
    match["userMappings.user_id"] = new mongoose.Types.ObjectId(user_id);
  }

  return await InspectionModel.aggregate([
    { $match: match },

    // Join user-inspection mapping
    {
      $lookup: {
        from: "mapuserinspections",
        localField: "_id",
        foreignField: "inspection_id",
        as: "userMappings"
      }
    },

    // Populate referenced data
    {
      $lookup: {
        from: "schema_sops",
        localField: "form_id",
        foreignField: "_id",
        as: "form_id"
      }
    },
    { $unwind: { path: "$form_id", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "schema_categories",
        localField: "form_id.categoryId",
        foreignField: "_id",
        as: "form_id.categoryId"
      }
    },

    {
      $lookup: {
        from: "schema_locations",
        localField: "location_id",
        foreignField: "_id",
        as: "location_id"
      }
    },

    {
      $lookup: {
        from: "schema_account",
        localField: "account_id",
        foreignField: "_id",
        as: "account_id"
      }
    },

    {
      $lookup: {
        from: "schema_user",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy"
      }
    },

    {
      $lookup: {
        from: "schema_user",
        localField: "updatedBy",
        foreignField: "_id",
        as: "updatedBy"
      }
    },

    // Clean arrays
    { $unwind: { path: "$location_id", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$account_id", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },

    { $sort: { createdAt: -1 } }
  ]);
};

export const getAllInspectionA = async (filter: any) => {
  return await InspectionModel.find(filter).populate([
    { path: 'form_id', model: "Schema_SOPs", populate: { path: 'categoryId', model: "Schema_Category", select: 'id name' } },
    { path: 'location_id', model: "Schema_Location", select: 'id location_name location_type' },
    { path: 'account_id', model: "Schema_Account", select: 'id account_name' },
    { path: 'createdBy', model: "Schema_User", select: 'id firstName lastName user_profile_img' }, 
    { path: 'updatedBy', model: "Schema_User", select: 'id firstName lastName user_profile_img' },
  ]);
};

export const createInspection = async (body: any, account_id: any, user_id: any) => {
  const newInspection = new InspectionModel({
    account_id,
    title: body.title,
    description: body.description,
    start_date: body.start_date,
    form_id: body.form_id,
    inspection_report: body.inspection_report,
    location_id: body.location_id,
    assignedUser: body.assignedUser,
    status: body.status,
    month: body.month,
    createdFrom: body.createdFrom,
    no_of_actions: body.no_of_actions,
    createdBy: user_id
  });
  await setInspection(account_id, newInspection._id, body.assignedUser);
  return await newInspection.save();
};

export const updateInspection = async (id: any, body: any, account_id: any, user_id: any) => {
  await setInspection(account_id, id, body.assignedUser);
  return await InspectionModel.findOneAndUpdate(
    { _id: id, account_id },
    { ...body, updatedBy: user_id },
    { new: true }
  );
};

export const removeInspection = async (id: any, account_id: any, user_id: any) => {
  await removeInspectionById(account_id, id);
  return await InspectionModel.findOneAndUpdate(
    { _id: id, account_id },
    { visible: false, updatedBy: user_id },
    { new: true }
  );
};
