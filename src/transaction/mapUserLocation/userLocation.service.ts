import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import { helperService } from "../../utils/helper";
import { mapUserToAssetService } from "../mapUserAsset/userAsset.service";

class MapUserToLocationService {
  getLocationsMappedData = async (userId: any) => {
    return await MapUserAssetLocationModel.find({ userId: helperService.validateObjectId(String(userId)), locationId: { $exists: true } });
  }

  getDataByLocationId = async (locationId: string) => {
    return await MapUserAssetLocationModel.find({ locationId: helperService.validateObjectId(String(locationId)), userId: { $exists: true } }).lean();
  }

  getDataByLocationIds = async (locationIds: string[]) => {
    return await MapUserAssetLocationModel.find({ locationId: { $in: helperService.validateObjectIds(locationIds.join(',')) }, userId: { $exists: true } }).lean();
  }

  mapUserLocationData = async (id: any, userIdList: any, account_id: any) => {
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

  userLocations = async (match: any, filter: any): Promise<any> => {
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
              { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_role: 1 } },
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

  getAllChildLocations = async (locationId: string, userIdList: string[]) => {
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

  updateAssetsForLocationHierarchy = async (locationId: string, userIdList: string[]) => {
    const assets = await AssetModel.find({ locationId: locationId, visible: true }).select("_id").lean();
    for (const asset of assets) {
      await mapUserToAssetService.updateUserMapping(`${asset._id}`, userIdList);
    }
    const childLocations = await LocationModel.find({ parent_id: locationId, visible: true }).select("_id").lean();
    for (const child of childLocations) {
      await this.updateAssetsForLocationHierarchy(child._id.toString(), userIdList);
    }
  };

  mapUserLocations = async (body: any, account_id: any): Promise<any> => {
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({ locationId: doc.locationId, userId: doc.userId, account_id }));
    })
    return await MapUserAssetLocationModel.insertMany(queryArray);
  };

  removeLocationMapping = async (id: any) => {
    return await MapUserAssetLocationModel.deleteMany({ locationId: id });
  }

  removeLocationListMapping = async (locationIdList: string[]) => {
    return await MapUserAssetLocationModel.deleteMany({ locationId: { $in: locationIdList } });
  }

  updateUserMapping = async (locationId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = []) => {
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
    const locationChildList = await LocationModel.find({ parent_id: helperService.validateObjectId(locationId) }).select("_id").lean();
    for (const { _id } of locationChildList) {
      const childExisting = await this.getDataByLocationId(String(_id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping(String(_id), childUserList, effectiveAdded, effectiveRemoved);
    }
  }

  addChildLocationMapping = async (locationId: string, userIdList: string[]) => {
    const locationObjectId = helperService.validateObjectId(locationId);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    await MapUserAssetLocationModel.insertMany(userIds.map(userId => ({ locationId: locationObjectId, userId: userId })));
  }

  removeChildLocationMapping = async (locationId: string, userIdList: string[]) => {
    const locationObjectId = helperService.validateObjectId(locationId);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    await MapUserAssetLocationModel.deleteMany({ locationId: locationObjectId, userId: { $in: userIds } });
  }
}

export const mapUserToLocationService = new MapUserToLocationService();