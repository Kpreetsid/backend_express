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

  mapUserLocationData = async (id: any, userIdList: any, account_id: any, session?: any) => {
    await this.getAllChildLocations(id, userIdList, session);
    await MapUserAssetLocationModel.deleteMany({ locationId: id }, { session });
    const queryArray: any = [];
    userIdList.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({
        locationId: id,
        userId: doc,
        account_id
      }));
    })
    await this.updateAssetsForLocationHierarchy(id, userIdList, session);
    return await MapUserAssetLocationModel.insertMany(queryArray, { session });
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
              { $match: { $expr: { $eq: ["$_id", "$$locId"] }, visible: true } },
              { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
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
              { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_role: 1, user_status: 1, user_profile_img: 1 } },
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

  getAllChildLocations = async (locationId: string, userIdList: string[], session?: any) => {
    const children = await LocationModel.find({ parent_id: locationId, visible: true }).select("_id").lean().session(session);
    if (!children?.length) return;
    const childIds = children.map(c => c._id.toString());
    const allMappedData = await MapUserAssetLocationModel.find({
      locationId: { $in: [locationId, ...childIds] },
      userId: { $in: userIdList }
    }).session(session);
    if (allMappedData?.length > 0) {
      await MapUserAssetLocationModel.deleteMany({
        locationId: { $in: childIds },
        userId: { $nin: userIdList }
      }, { session });
    }
    await Promise.all(childIds.map(async (id: string) => await this.getAllChildLocations(id, userIdList, session)));
  }

  updateAssetsForLocationHierarchy = async (locationId: string, userIdList: string[], session?: any) => {
    const assets = await AssetModel.find({ locationId: locationId, visible: true }).select("_id").lean().session(session);
    for (const asset of assets) {
      await mapUserToAssetService.updateUserMapping(`${asset._id}`, userIdList, [], [], session);
    }
    const childLocations = await LocationModel.find({ parent_id: locationId, visible: true }).select("_id").lean().session(session);
    for (const child of childLocations) {
      await this.updateAssetsForLocationHierarchy(child._id.toString(), userIdList, session);
    }
  };

  mapUserLocations = async (body: any, account_id: any): Promise<any> => {
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({ locationId: doc.locationId, userId: doc.userId, account_id }));
    })
    return await MapUserAssetLocationModel.insertMany(queryArray);
  };

  removeLocationMapping = async (id: any, session?: any) => {
    return await MapUserAssetLocationModel.deleteMany({ locationId: id }, { session });
  }

  removeLocationListMapping = async (locationIdList: string[], session?: any) => {
    return await MapUserAssetLocationModel.deleteMany({ locationId: { $in: locationIdList } }, { session });
  }

  updateUserMapping = async (locationId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = [], session?: any) => {
    const locationUserMappings = await this.getDataByLocationId(locationId);
    const existingUsers = locationUserMappings.map((u: any) => String(u.userId));
    const addedUsers = userIdList.filter(id => !existingUsers.includes(id));
    const removedUsers = existingUsers.filter(id => !userIdList.includes(id));
    const effectiveAdded = Array.from([...new Set([...addedUsers, ...inheritedAdded])]);
    const effectiveRemoved = Array.from([...new Set([...removedUsers, ...inheritedRemoved])]);
    if (effectiveAdded.length > 0) {
      await this.addChildLocationMapping(locationId, effectiveAdded, session);
    }
    if (effectiveRemoved.length > 0) {
      await this.removeChildLocationMapping(locationId, effectiveRemoved, session);
    }
    await mapUserToAssetService.updateAssetsForLocationHierarchy(locationId, userIdList, session);
    const locationChildList = await LocationModel.find({ parent_id: helperService.validateObjectId(locationId) }).select("_id").lean().session(session);
    for (const { _id } of locationChildList) {
      const childExisting = await this.getDataByLocationId(String(_id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping(String(_id), childUserList, effectiveAdded, effectiveRemoved, session);
    }
  }

  addChildLocationMapping = async (locationId: string, userIdList: string[], session?: any) => {
    const locationObjectId = helperService.validateObjectId(locationId);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    await MapUserAssetLocationModel.insertMany(userIds.map(userId => ({ locationId: locationObjectId, userId: userId })), { session });
  }

  removeChildLocationMapping = async (locationId: string, userIdList: string[], session?: any) => {
    const locationObjectId = helperService.validateObjectId(locationId);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    await MapUserAssetLocationModel.deleteMany({ locationId: locationObjectId, userId: { $in: userIds } }, { session });
  }
}

export const mapUserToLocationService = new MapUserToLocationService();