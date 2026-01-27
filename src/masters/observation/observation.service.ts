import { ObservationModel } from "../../models/observation.model";

class ObservationService {
  async getAllObservation (match: any): Promise<any> {
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
      { $sort: { _id: -1 } },
      { $addFields: { id: "$_id" } }
    ]);
  };
  
  async insertObservation (body: any, account_id: any, user_id: any): Promise<any> {
    const newObservation = new ObservationModel({ accountId: account_id, ...body, userId: user_id, createdBy: user_id });
    return await newObservation.save();
  };
  
  async updateObservationById (id: any, body: any, user_id: any): Promise<any> {
    return await ObservationModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
  };
  
  async removeObservationById (id: any, user_id: any): Promise<any> {
    return await ObservationModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
  };
  
  async deleteObservationById (id: string): Promise<any> {
    return await ObservationModel.deleteOne({ _id: id });
  };
}

export const observationService = new ObservationService();