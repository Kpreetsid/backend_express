import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import mongoose from "mongoose";

class MapUserToAssetService {
  async getAssetsMappedData (userId: any) {
    return await MapUserAssetLocationModel.find({ userId: new mongoose.Types.ObjectId(userId), assetId: { $exists: true } });
  }

  async getDataByAssetId (assetId: string) {
    return await MapUserAssetLocationModel.find({ assetId: new mongoose.Types.ObjectId(assetId), userId: { $exists: true } });
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

  async getAllChildAssets (assetId: string, userIdList: string[]) {
    const children = await AssetModel.find({ parent_id: assetId, visible: true }).select("_id").lean();
    if (!children?.length) return;
    const childIds = children.map(c => c._id.toString());
    const allMappedData = await MapUserAssetLocationModel.find({
      assetId: { $in: [assetId, ...childIds] },
      userId: { $exists: true }
    }).lean();
    if (allMappedData?.length > 0) {
      await MapUserAssetLocationModel.deleteMany({
        assetId: { $in: childIds },
        userId: { $nin: userIdList }
      });
    }
    for (const childId of childIds) {
      await this.getAllChildAssets(childId, userIdList);
    }
  };

  async updateMapUserAssets (assetId: string, userIdList: string[]): Promise<any> {
    await this.getAllChildAssets(assetId, userIdList);
    await MapUserAssetLocationModel.deleteMany({ assetId });
    if (userIdList.length > 0) {
      const queryArray = userIdList.map(userId => ({ assetId, userId }));
      await MapUserAssetLocationModel.insertMany(queryArray);
    }
    return assetId;
  };

  async updateMappedUserFlags (body: any): Promise<any> {
    const bulkOps = body.map((doc: any) => {
      if (!doc._id || typeof doc.sendMail !== 'boolean') {
        throw Object.assign(new Error('Each item must have _id and sendMail (boolean)'), { status: 400 });
      }
      return {
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(doc._id) },
          update: { $set: { sendMail: doc.sendMail } }
        }
      };
    });
    return await MapUserAssetLocationModel.bulkWrite(bulkOps);
  };

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
    return await MapUserAssetLocationModel.find({ locationId: { $in: locationIds.map(id => new mongoose.Types.ObjectId(id)) }, userId: { $exists: true } });
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
            as: "location",
          },
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
            as: "user",
          },
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
      await mapUserToAssetService.updateMapUserAssets(asset._id.toString(), userIdList);
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
    const effectiveAdded = [...new Set([...addedUsers, ...inheritedAdded])];
    const effectiveRemoved = [...new Set([...removedUsers, ...inheritedRemoved])];
    if (effectiveAdded.length > 0) {
      await this.addChildLocationMapping(locationId, effectiveAdded);
    }
    if (effectiveRemoved.length > 0) {
      await this.removeChildLocationMapping(locationId, effectiveRemoved);
    }
    const locationChildList = await LocationModel.find({ parent_id: new mongoose.Types.ObjectId(locationId) }).select("_id").lean();
    for (const child of locationChildList) {
      const childExisting = await this.getDataByLocationId(String(child._id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping( String(child._id), childUserList, effectiveAdded, effectiveRemoved );
    }
  }

  async addChildLocationMapping(locationId: string, userIdList: string[]) {
    await MapUserAssetLocationModel.insertMany(userIdList.map(userId => ({ locationId: new mongoose.Types.ObjectId(locationId), userId: new mongoose.Types.ObjectId(userId) })));
  }

  async removeChildLocationMapping(locationId: string, userIdList: string[]) {
    await MapUserAssetLocationModel.deleteMany({ locationId: new mongoose.Types.ObjectId(locationId), userId: { $in: userIdList.map(id => new mongoose.Types.ObjectId(id)) } });
  }
}

export const mapUserToLocationService = new MapUserToLocationService();