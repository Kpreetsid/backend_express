import { InspectionModel } from "../models/inspection.model";
import { setInspection, removeInspectionById } from "../transaction/mapUserInspection/userInspection.service";

export const getAllInspection = async (filter: any) => {
  const data = await InspectionModel.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: "map_user_inspection", let: { inspId: "$_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$inspection_id", "$$inspId"] } } },
          {
            $lookup: {
              from: "users", let: { uId: "$user_id" }, pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
                { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1 } }
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
        from: "sops", let: { formId: "$form_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$formId"] } } },
          {
            $lookup: {
              from: "form_category", let: { catId: "$categoryId" }, pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$catId"] } } },
                { $project: { _id: 1, id: "$_id", name: 1 } }
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
        from: "location_master", let: { locId: "$location_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$locId"] } } },
          { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1 } }
        ],
        as: "location_id"
      }
    },
    { $unwind: { path: "$location_id", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "asset_master", let: { assetId: "$asset_id" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$assetId"] } } },
          { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1 } }
        ],
        as: "asset_id"
    }},
    { $unwind: { path: "$asset_id", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users", let: { uId: "$createdBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1 } }
        ],
        as: "createdBy"
      }
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users", let: { uId: "$updatedBy" }, pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
          { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1 } }
        ],
        as: "updatedBy"
      }
    },
    { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } }
  ]);
  return data;
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
    asset_id: body.asset_id,
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
