import { ObservationModel } from "../../models/observation.model";
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";
import { UserModel } from "../../models/user.model";

class ObservationService {
  async getAllObservation (match: any): Promise<any> {
    return await ObservationModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { assetId: "$assetId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$assetId"] }, visible: true } },
            { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "asset"
        }
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { locationId: "$locationId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$locationId"] }, visible: true } },
            { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "location"
        }
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { userId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_role: 1, user_status: 1, user_profile_img: 1 } },
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
    return await ObservationModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { returnDocument: 'after' });
  };

  async updateObservation (match: any, body: any): Promise<any> {
    return await ObservationModel.updateMany(match, { ...body });
  };
  
  async removeObservationById (id: any, user_id: any): Promise<any> {
    return await ObservationModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { returnDocument: 'after' });
  };
  
  async deleteObservationById (id: string): Promise<any> {
    return await ObservationModel.deleteOne({ _id: id });
  };
}

export const observationService = new ObservationService();