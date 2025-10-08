import { ObservationModel } from "../../models/observation.model";
import { getExternalData } from "../../util/externalAPI";

export const getAllObservation = async (match: any): Promise<any> => {
  return await ObservationModel.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "asset_master",
        let: { assetId: "$assetId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$assetId"] } } },
          { $project: { _id: 1, asset_name: 1, asset_type: 1 } },
          { $addFields: { id: "$_id" } }
        ],
        as: "asset"
      }
    },
    { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "location_master",
        let: { locationId: "$locationId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$locationId"] } } },
          { $project: { _id: 1, location_name: 1, location_type: 1 } },
          { $addFields: { id: "$_id" } }
        ],
        as: "location"
      }
    },
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        let: { userId: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
          { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
          { $addFields: { id: "$_id" } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $addFields: { id: "$_id" } }
  ]);
};

export const insertObservation = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const newObservation = new ObservationModel({ accountId: account_id, ...body, userId: user_id, createdBy: user_id });
  return await newObservation.save();
};

export const setAssetHealthStatus = async (body: any, account_id: any, user_id: any, token: any) => {
  const payload: any = { "asset_id": body.assetId, "asset_status": body.status, "org_id": account_id };
  if(body.alarm_id) {
    payload.alarm_id = body.alarm_id;
  }
  await getExternalData(`/asset_health_status/`, 'PATCH', payload, token, user_id);
}

export const updateObservationById = async (id: string, body: any, user_id: any): Promise<any> => {
  return await ObservationModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
};

export const removeObservationById = async (id: string, user_id: any): Promise<any> => {
  return await ObservationModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};

export const deleteObservationById = async (id: string): Promise<any> => {
  return await ObservationModel.deleteOne({ _id: id });
};