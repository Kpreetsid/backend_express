import { InspectionModel } from "../models/inspection.model";

export const getAllInspection = async (filter: any) => {
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
    formCategory: body.formCategory,
    status: body.status,
    month: body.month,
    createdFrom: body.createdFrom,
    no_of_actions: body.no_of_actions,
    createdBy: user_id
  });
  return await newInspection.save();
};

export const updateInspection = async (id: any, body: any, account_id: any, user_id: any) => {
  return await InspectionModel.findOneAndUpdate(
    { _id: id, account_id },
    { ...body, updatedBy: user_id },
    { new: true }
  );
};

export const removeInspection = async (id: any, account_id: any, user_id: any) => {
  return await InspectionModel.findOneAndUpdate(
    { _id: id, account_id },
    { visible: false, updatedBy: user_id },
    { new: true }
  );
};
