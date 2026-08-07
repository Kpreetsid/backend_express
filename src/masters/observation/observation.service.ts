import { ObservationModel } from "../../models/observation.model";
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";
import { UserModel } from "../../models/user.model";
import { ClientSession } from "mongoose";

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
  
  async requireTenantReferences (
    body: any,
    account_id: any,
    session?: ClientSession
  ): Promise<void> {
    const assetIds = [...new Set(
      [body.assetId, body.top_level_asset_id]
        .filter(Boolean)
        .map((id) => String(id))
    )];
    const assetQuery = AssetModel.countDocuments({
      _id: { $in: assetIds },
      account_id,
      visible: true
    });
    const locationQuery = body.locationId
      ? LocationModel.countDocuments({
        _id: body.locationId,
        account_id,
        visible: true
      })
      : null;
    if (session) {
      assetQuery.session(session);
      locationQuery?.session(session);
    }

    const [assetCount, locationCount] = await Promise.all([
      assetIds.length ? assetQuery : Promise.resolve(0),
      locationQuery || Promise.resolve(0)
    ]);
    if (
      (assetIds.length > 0 && assetCount !== assetIds.length)
      || (body.locationId && locationCount !== 1)
    ) {
      throw Object.assign(
        new Error('Observation asset or location not found'),
        { status: 404 }
      );
    }
  }

  async insertObservation (
    body: any,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ): Promise<any> {
    const newObservation = new ObservationModel({
      ...body,
      accountId: account_id,
      userId: user_id,
      createdBy: user_id
    });
    return await newObservation.save(session ? { session } : {});
  };

  async updateObservationById (
    id: any,
    body: any,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ): Promise<any> {
    return await ObservationModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      { ...body, updatedBy: user_id },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );
  };

  async updateObservation (
    match: any,
    body: any,
    session?: ClientSession
  ): Promise<any> {
    return await ObservationModel.updateMany(
      match,
      { ...body },
      session ? { session } : {}
    );
  };
  
  async removeObservationById (id: any, account_id: any, user_id: any): Promise<any> {
    return await ObservationModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      { updatedBy: user_id, visible: false },
      { returnDocument: 'after' }
    );
  };
  
  async deleteObservationById (id: string): Promise<any> {
    return await ObservationModel.deleteOne({ _id: id });
  };
}

export const observationService = new ObservationService();
