import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import { helperService } from "../../util/helper";

class MapUserToAssetService {
  private buildAlarmFlags = (alarmType: string[] = []) => ({
    alert: alarmType.includes("alert"),
    danger: alarmType.includes("danger"),
    critical: alarmType.includes("critical"),
    sendMail: alarmType.includes("sendMail"),
  });

  getAssetsMappedData = async (userId: any) => {
    return await MapUserAssetLocationModel.find({
      userId: helperService.validateObjectId(userId),
      assetId: { $exists: true },
    }).lean();
  };

  getDataByAssetId = async (assetId: string) => {
    return await MapUserAssetLocationModel.find({
      assetId: helperService.validateObjectId(assetId),
      userId: { $exists: true },
    }).lean();
  };

  createMapUserAssets = async (data: any): Promise<any> => {
    return await MapUserAssetLocationModel.insertMany(data);
  };

  userAssets = async (match: any, populate: any): Promise<any> => {
    const pipeline: any[] = [{ $match: match }];
    if (populate === "assetId") {
      pipeline.push({
        $lookup: {
          from: "asset_master",
          let: { assetId: "$assetId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$assetId"] } } },
            { $project: { _id: 1, asset_name: 1, asset_type: 1 } },
            { $addFields: { id: "$_id" } },
          ],
          as: "asset",
        },
      });
      pipeline.push({ $unwind: "$asset" });
    }
    if (populate === "userId") {
      pipeline.push({
        $lookup: {
          from: "users",
          let: { userId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
            { $addFields: { id: "$_id" } },
          ],
          as: "user",
        },
      });
      pipeline.push({ $unwind: "$user" });
    }
    pipeline.push({ $addFields: { id: "$_id" } });
    return await MapUserAssetLocationModel.aggregate(pipeline);
  };

  updateMappedUserFlags = async (body: any): Promise<any> => {
    const bulkOps = body.map((doc: any) => {
      if (
        !doc._id ||
        typeof doc.sendMail !== "boolean" ||
        typeof doc.alert !== "boolean" ||
        typeof doc.danger !== "boolean" ||
        typeof doc.critical !== "boolean"
      ) {
        throw Object.assign(
          new Error("Each item must have _id and sendMail (boolean)"),
          { status: 400 },
        );
      }
      return {
        updateOne: {
          filter: { _id: helperService.validateObjectId(doc._id) },
          update: {
            $set: {
              sendMail: doc.sendMail,
              alert: doc.alert,
              danger: doc.danger,
              critical: doc.critical,
            },
          },
        },
      };
    });
    return await MapUserAssetLocationModel.bulkWrite(bulkOps);
  };

  updateAssetsForLocationHierarchy = async (
    locationId: string,
    userIdList: string[],
  ) => {
    const assetList = await AssetModel.find({
      locationId: helperService.validateObjectId(locationId),
    })
      .select("_id")
      .lean();
    for (const { _id } of assetList) {
      await this.updateUserMapping(String(_id), userIdList);
    }
  };

  updateUserMapping = async (assetId: string, userIdList: any, inheritedAdded: string[] = [], inheritedRemoved: string[] = []) => {
    const assetUserMappings = await this.getDataByAssetId(assetId);
    const existingUsers = assetUserMappings.map((u: any) => String(u.userId));
    const addedUsers = userIdList.filter((id: any) => !existingUsers.includes(id));
    const removedUsers = existingUsers.filter((id: any) => !userIdList.includes(id));
    const effectiveAdded = Array.from([...new Set([...addedUsers, ...inheritedAdded])]);
    const effectiveRemoved = Array.from([...new Set([...removedUsers, ...inheritedRemoved])]);
    if (effectiveAdded.length > 0) {
      await this.addChildAssetMapping(assetId, effectiveAdded);
    }
    if (effectiveRemoved.length > 0) {
      await this.removeChildAssetMapping(assetId, effectiveRemoved);
    }
    const assetChildList = await AssetModel.find({ parent_id: helperService.validateObjectId(assetId) }).select("_id").lean();
    for (const { _id } of assetChildList) {
      const childExisting = await this.getDataByAssetId(String(_id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping(String(_id), childUserList, effectiveAdded, effectiveRemoved);
    }
  };

  updateFlagOnAssetUpdate = async (assetId: any, userIdList: string[], alarmType: string[]) => {
    if (!userIdList?.length) return { matched: 0, modified: 0 };
    const assetObjectId = helperService.validateObjectId(assetId);
    const userObjectIds = helperService.validateObjectIds(userIdList.join(','));
    const newFlags: any = this.buildAlarmFlags(alarmType);
    const result: any = await MapUserAssetLocationModel.updateMany(
      {
        assetId: assetObjectId,
        userId: { $in: userObjectIds },
        $or: [
          { alert: { $ne: newFlags.alert } },
          { danger: { $ne: newFlags.danger } },
          { critical: { $ne: newFlags.critical } },
          { sendMail: { $ne: newFlags.sendMail } },
        ]
      },
      { $set: newFlags }
    );

    const assetChildList = await AssetModel.find({ parent_id: assetObjectId }).select("_id").lean();
    for (const { _id } of assetChildList) {
      await this.updateFlagOnAssetUpdate(String(_id), userIdList, alarmType);
    }

    return {
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified
    };
  };

  addChildAssetMapping = async (id: string, userIdList: string[]) => {
    const assetId = helperService.validateObjectId(id);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    const queryArray = userIds.map((userId) => {
      const mapData: any = {
        assetId: assetId,
        userId: userId,
      };
      return mapData;
    });
    await MapUserAssetLocationModel.insertMany(queryArray);
  }

  removeChildAssetMapping = async (id: string, userIdList: string[]) => {
    const assetId = helperService.validateObjectId(id);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    await MapUserAssetLocationModel.deleteMany({
      assetId: assetId,
      userId: {
        $in: userIds,
      },
    });
  }

  removeAssetMapping = async (id: string) => {
    return await MapUserAssetLocationModel.deleteMany({ assetId: id });
  }

  removeAssetListMapping = async (assetIdList: string[]) => {
    return await MapUserAssetLocationModel.deleteMany({
      assetId: { $in: assetIdList },
    });
  }
}

export const mapUserToAssetService = new MapUserToAssetService();

class MapUserToLocationService {
  getLocationsMappedData = async (userId: any) => {
    return await MapUserAssetLocationModel.find({ userId: helperService.validateObjectId(userId), locationId: { $exists: true } });
  }

  getDataByLocationId = async (locationId: string) => {
    return await MapUserAssetLocationModel.find({ locationId: helperService.validateObjectId(locationId), userId: { $exists: true } }).lean();
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

export const updateLocationAssetMapping = async (locationId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = []) => {
  const locationObjectId = helperService.validateObjectId(locationId);
  const locationMappings = await MapUserAssetLocationModel.find({ locationId: locationObjectId, userId: { $exists: true } }).lean();
  const existingUsers = locationMappings.map(d => String(d.userId));
  const addedUsers = userIdList.filter(id => !existingUsers.includes(id));
  const removedUsers = existingUsers.filter(id => !userIdList.includes(id));
  const effectiveAdded = [...new Set([...addedUsers, ...inheritedAdded])];
  const effectiveRemoved = [...new Set([...removedUsers, ...inheritedRemoved])];
  if (effectiveAdded.length) {
    const effectiveAddedIds = helperService.validateObjectIds(effectiveAdded.join(','));
    await MapUserAssetLocationModel.insertMany(effectiveAddedIds.map(userId => ({ locationId: locationObjectId, userId: userId })), { ordered: false });
  }
  if (effectiveRemoved.length) {
    const effectiveRemovedIds = helperService.validateObjectIds(effectiveRemoved.join(','));
    await MapUserAssetLocationModel.deleteMany({ locationId: locationObjectId, userId: { $in: effectiveRemovedIds } });
  }
  const assets = await AssetModel.find({ locationId: locationObjectId }).select('_id').lean();
  for (const asset of assets) {
    const assetId = helperService.validateObjectId(String(asset._id));
    const assetMappings = await MapUserAssetLocationModel.find({ assetId, userId: { $exists: true } }).lean();
    const assetUsers = assetMappings.map(d => String(d.userId));
    const assetAdded = effectiveAdded.filter(id => !assetUsers.includes(id));
    const assetRemoved = effectiveRemoved.filter(id => assetUsers.includes(id));
    if (assetAdded.length) {
      const assetAddedIds = helperService.validateObjectIds(assetAdded.join(','));
      await MapUserAssetLocationModel.insertMany(assetAddedIds.map(userId => ({ assetId, userId: userId })), { ordered: false });
    }
    if (assetRemoved.length) {
      const assetRemovedIds = helperService.validateObjectIds(assetRemoved.join(','));
      await MapUserAssetLocationModel.deleteMany({ assetId, userId: { $in: assetRemovedIds } });
    }
    const childAssets = await AssetModel.find({ parent_id: assetId }).select('_id').lean();
    for (const child of childAssets) {
      const childAssetId = helperService.validateObjectId(String(child._id));
      const childMappings = await MapUserAssetLocationModel.find({ assetId: childAssetId, userId: { $exists: true } }).lean();
      const childUsers = childMappings.map(d => String(d.userId));
      await updateLocationAssetMapping(String(child._id), childUsers, assetAdded, assetRemoved);
    }
  }
  const childLocations = await LocationModel.find({ parent_id: locationObjectId }).select('_id').lean();
  for (const child of childLocations) {
    const childLocationId = helperService.validateObjectId(String(child._id));
    const childMappings = await MapUserAssetLocationModel.find({ locationId: childLocationId, userId: { $exists: true } }).lean();
    const childUsers = childMappings.map(d => String(d.userId));
    await updateLocationAssetMapping(String(child._id), childUsers, effectiveAdded, effectiveRemoved);
  }
};