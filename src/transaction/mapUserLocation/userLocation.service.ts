import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import mongoose from "mongoose";

class MapUserToAssetService {
  async getAssetsMappedData (userId: any) {
    return await MapUserAssetLocationModel.find({ userId: new mongoose.Types.ObjectId(userId), assetId: { $exists: true } }).lean();
  }

  async getDataByAssetId (assetId: string) {
    return await MapUserAssetLocationModel.find({ assetId: new mongoose.Types.ObjectId(assetId), userId: { $exists: true } }).lean();
  }

  async createMapUserAssets (data: any): Promise<any> {
    return await MapUserAssetLocationModel.insertMany(data);
  };

  async userAssets (match: any, populate: any): Promise<any> {
    const pipeline: any[] = [{ $match: match }];
    if (populate === 'assetId') {
      pipeline.push({
        $lookup: {
          from: "asset_master",
          let: { assetId: "$assetId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$assetId"] } } },
            { $project: { _id: 1, asset_name: 1, asset_type: 1 } },
            { $addFields: { id: '$_id' } }
          ],
          as: "asset",
        },
      });
      pipeline.push({ $unwind: "$asset" });
    }
    if (populate === 'userId') {
      pipeline.push({
        $lookup: {
          from: "users",
          let: { userId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
            { $addFields: { id: '$_id' } }
          ],
          as: "user",
        },
      });
      pipeline.push({ $unwind: "$user" });
    }
    pipeline.push({ $addFields: { id: '$_id' } });
    return await MapUserAssetLocationModel.aggregate(pipeline);
  };

  async updateMappedUserFlags (body: any): Promise<any> {
    const bulkOps = body.map((doc: any) => {
      if (!doc._id || typeof doc.sendMail !== 'boolean' || typeof doc.alert !== 'boolean' || typeof doc.danger !== 'boolean' || typeof doc.critical !== 'boolean') {
        throw Object.assign(new Error('Each item must have _id and sendMail (boolean)'), { status: 400 });
      }
      return {
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(doc._id) },
          update: { $set: { sendMail: doc.sendMail, alert: doc.alert, danger: doc.danger, critical: doc.critical} }
        }
      };
    });
    return await MapUserAssetLocationModel.bulkWrite(bulkOps);
  };

  async updateAssetsForLocationHierarchy (locationId: string, userIdList: string[]) {
    const assetList = await AssetModel.find({ locationId: new mongoose.Types.ObjectId(locationId) }).select("_id").lean();
    for (const { _id } of assetList) {
      await this.updateUserMapping(String(_id), userIdList);
    }
  }

  async updateUserMapping(assetId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = []) {
    const assetUserMappings = await this.getDataByAssetId(assetId);
    const existingUsers = assetUserMappings.map((u: any) => String(u.userId));
    const addedUsers = userIdList.filter(id => !existingUsers.includes(id));
    const removedUsers = existingUsers.filter(id => !userIdList.includes(id));
    const effectiveAdded = Array.from([...new Set([...addedUsers, ...inheritedAdded])]);
    const effectiveRemoved = Array.from([...new Set([...removedUsers, ...inheritedRemoved])]);
    if (effectiveAdded.length > 0) {
      await this.addChildAssetMapping(assetId, effectiveAdded);
    }
    if (effectiveRemoved.length > 0) {
      await this.removeChildAssetMapping(assetId, effectiveRemoved);
    }
    const assetChildList = await AssetModel.find({ parent_id: new mongoose.Types.ObjectId(assetId) }).select("_id").lean();
    for (const { _id } of assetChildList) {
      const childExisting = await this.getDataByAssetId(String(_id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping( String(_id), childUserList, effectiveAdded, effectiveRemoved );
    }
  }

  async addChildAssetMapping (id: string, userIdList: string[]) {
    const queryArray = userIdList.map(userId => ({ assetId: new mongoose.Types.ObjectId(String(id)), userId: new mongoose.Types.ObjectId(userId) }));
    await MapUserAssetLocationModel.insertMany(queryArray);
  }

  async removeChildAssetMapping (id: string, userIdList: string[]) {
    await MapUserAssetLocationModel.deleteMany({ assetId: new mongoose.Types.ObjectId(String(id)), userId: { $in: userIdList.map(id => new mongoose.Types.ObjectId(String(id))) } });
  }

  async removeAssetMapping (id: string) {
    return await MapUserAssetLocationModel.deleteMany({ assetId: id });
  }

  async removeAssetListMapping (assetIdList: string[]) {
    return await MapUserAssetLocationModel.deleteMany({ assetId: { $in: assetIdList } });
  }

}

export const mapUserToAssetService = new MapUserToAssetService();

class MapUserToLocationService {
  async getLocationsMappedData (userId: any) {
    return await MapUserAssetLocationModel.find({ userId: new mongoose.Types.ObjectId(userId), locationId: { $exists: true } });
  }

  async getDataByLocationId (locationId: string) {
    return await MapUserAssetLocationModel.find({ locationId: new mongoose.Types.ObjectId(locationId), userId: { $exists: true } }).lean();
  }
  
  async getDataByLocationIds (locationIds: string[]) {
    return await MapUserAssetLocationModel.find({ locationId: { $in: locationIds.map(id => new mongoose.Types.ObjectId(String(id))) }, userId: { $exists: true } }).lean();
  }

  async mapUserLocationData (id: any, userIdList: any, account_id: any) {
    await this.getAllChildLocations(id, userIdList);
    await MapUserAssetLocationModel.deleteMany({ locationId: id });
    const queryArray: any = [];
    userIdList.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({
        locationId: id,
        userId: doc,
        account_id
      }));
    })
    await this.updateAssetsForLocationHierarchy(id, userIdList);
    return await MapUserAssetLocationModel.insertMany(queryArray);
  }

  async userLocations (match: any, filter: any): Promise<any> {
    const pipeline: any[] = [{ $match: match }];
    if (filter.populate === "locationId") {
      pipeline.push(
        {
          $lookup: {
            from: "location_master",
            let: { locId: "$locationId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$locId"] } } },
              { $addFields: { id: '$_id' } }
            ],
            as: "location"
          }
        },
        { $unwind: "$location" }
      );
    } else if (filter.populate === "userId") {
      pipeline.push(
        {
          $lookup: {
            from: "users",
            let: { userId: "$userId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
              { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
              { $addFields: { id: '$_id' } }
            ],
            as: "user"
          }
        },
        { $unwind: "$user" }
      );
    }
    pipeline.push({ $addFields: { id: "$_id" } });
    let data = await MapUserAssetLocationModel.aggregate(pipeline);
    if (!data?.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    data = data.map((doc: any) => {
      if (doc.location) {
        doc.location.id = doc.location._id;
      }
      if (doc.user) {
        doc.user.id = doc.user._id;
      }
      return doc;
    });
    return data;
  };

  async getAllChildLocations (locationId: string, userIdList: string[]) {
    const children = await LocationModel.find({ parent_id: locationId, visible: true }).select("_id").lean();
    if (!children?.length) return;
    const childIds = children.map(c => c._id.toString());
    const allMappedData = await MapUserAssetLocationModel.find({
      locationId: { $in: [locationId, ...childIds] },
      userId: { $in: userIdList }
    });
    if (allMappedData?.length > 0) {
      await MapUserAssetLocationModel.deleteMany({
        locationId: { $in: childIds },
        userId: { $nin: userIdList }
      });
    }
    await Promise.all(childIds.map(async (id: string) => await this.getAllChildLocations(id, userIdList)));
  }

  async updateAssetsForLocationHierarchy (locationId: string, userIdList: string[]) {
    const assets = await AssetModel.find({ locationId: locationId, visible: true }).select("_id").lean();
    for (const asset of assets) {
      await mapUserToAssetService.updateUserMapping(`${asset._id}`, userIdList);
    }
    const childLocations = await LocationModel.find({ parent_id: locationId, visible: true }).select("_id").lean();
    for (const child of childLocations) {
      await this.updateAssetsForLocationHierarchy(child._id.toString(), userIdList);
    }
  };

  async mapUserLocations (body: any, account_id: any): Promise<any> {
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({ locationId: doc.locationId, userId: doc.userId, account_id }));
    })
    return await MapUserAssetLocationModel.insertMany(queryArray);
  };

  async removeLocationMapping (id: string) {
    return await MapUserAssetLocationModel.deleteMany({ locationId: id });
  }
  
  async removeLocationListMapping (locationIdList: string[]) {
    return await MapUserAssetLocationModel.deleteMany({ locationId: { $in: locationIdList } });
  }

  async updateUserMapping(locationId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = []) {
    const locationUserMappings = await this.getDataByLocationId(locationId);
    const existingUsers = locationUserMappings.map((u: any) => String(u.userId));
    const addedUsers = userIdList.filter(id => !existingUsers.includes(id));
    const removedUsers = existingUsers.filter(id => !userIdList.includes(id));
    const effectiveAdded = Array.from([...new Set([...addedUsers, ...inheritedAdded])]);
    const effectiveRemoved = Array.from([...new Set([...removedUsers, ...inheritedRemoved])]);
    if (effectiveAdded.length > 0) {
      await this.addChildLocationMapping(locationId, effectiveAdded);
    }
    if (effectiveRemoved.length > 0) {
      await this.removeChildLocationMapping(locationId, effectiveRemoved);
    }
    await mapUserToAssetService.updateAssetsForLocationHierarchy(locationId, userIdList);
    const locationChildList = await LocationModel.find({ parent_id: new mongoose.Types.ObjectId(locationId) }).select("_id").lean();
    for (const { _id } of locationChildList) {
      const childExisting = await this.getDataByLocationId(String(_id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping( String(_id), childUserList, effectiveAdded, effectiveRemoved );
    }
  }

  async addChildLocationMapping(locationId: string, userIdList: string[]) {
    await MapUserAssetLocationModel.insertMany(userIdList.map(userId => ({ locationId: new mongoose.Types.ObjectId(locationId), userId: new mongoose.Types.ObjectId(userId) })));
  }

  async removeChildLocationMapping(locationId: string, userIdList: string[]) {
    await MapUserAssetLocationModel.deleteMany({ locationId: new mongoose.Types.ObjectId(locationId), userId: { $in: userIdList.map(id => new mongoose.Types.ObjectId(String(id))) } });
  }
}

export const mapUserToLocationService = new MapUserToLocationService();

export const updateLocationAssetMapping = async (locationId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = []) => {
  const locationObjectId = new mongoose.Types.ObjectId(locationId);
  const locationMappings = await MapUserAssetLocationModel.find({ locationId: locationObjectId, userId: { $exists: true } }).lean();
  const existingUsers = locationMappings.map(d => String(d.userId));
  const addedUsers = userIdList.filter(id => !existingUsers.includes(id));
  const removedUsers = existingUsers.filter(id => !userIdList.includes(id));
  const effectiveAdded = [...new Set([...addedUsers, ...inheritedAdded])];
  const effectiveRemoved = [...new Set([...removedUsers, ...inheritedRemoved])];
  if (effectiveAdded.length) {
    await MapUserAssetLocationModel.insertMany(effectiveAdded.map(userId => ({ locationId: locationObjectId, userId: new mongoose.Types.ObjectId(userId) })), { ordered: false });
  }
  if (effectiveRemoved.length) {
    await MapUserAssetLocationModel.deleteMany({ locationId: locationObjectId, userId: { $in: effectiveRemoved.map(id => new mongoose.Types.ObjectId(String(id))) }});
  }
  const assets = await AssetModel.find({ locationId: locationObjectId }).select('_id').lean();
  for (const asset of assets) {
    const assetId = new mongoose.Types.ObjectId(asset._id);
    const assetMappings = await MapUserAssetLocationModel.find({ assetId, userId: { $exists: true } }).lean();
    const assetUsers = assetMappings.map(d => String(d.userId));
    const assetAdded = effectiveAdded.filter(id => !assetUsers.includes(id));
    const assetRemoved = effectiveRemoved.filter(id => assetUsers.includes(id));
    if (assetAdded.length) {
      await MapUserAssetLocationModel.insertMany( assetAdded.map(userId => ({ assetId, userId: new mongoose.Types.ObjectId(userId) })), { ordered: false });
    }
    if (assetRemoved.length) {
      await MapUserAssetLocationModel.deleteMany({ assetId, userId: { $in: assetRemoved.map(id => new mongoose.Types.ObjectId(String(id))) } });
    }
    const childAssets = await AssetModel.find({ parent_id: assetId }).select('_id').lean();
    for (const child of childAssets) {
      const childMappings = await MapUserAssetLocationModel.find({ assetId: new mongoose.Types.ObjectId(child._id), userId: { $exists: true } }).lean();
      const childUsers = childMappings.map(d => String(d.userId));
      await updateLocationAssetMapping(String(child._id), childUsers, assetAdded, assetRemoved);
    }
  }
  const childLocations = await LocationModel.find({ parent_id: locationObjectId }).select('_id').lean();
  for (const child of childLocations) {
    const childMappings = await MapUserAssetLocationModel.find({ locationId: new mongoose.Types.ObjectId(child._id), userId: { $exists: true }}).lean();
    const childUsers = childMappings.map(d => String(d.userId));
    await updateLocationAssetMapping(String(child._id), childUsers, effectiveAdded, effectiveRemoved);
  }
};