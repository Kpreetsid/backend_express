import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import { helperService } from "../../utils/helper";

class MapUserToAssetService {
  private buildAlarmFlags = (alarmType: string[] = []) => ({
    alert: alarmType.includes("alert"),
    danger: alarmType.includes("danger"),
    critical: alarmType.includes("critical"),
    sendMail: alarmType.includes("sendMail"),
  });

  getAssetsMappedData = async (userId: any) => {
    return await MapUserAssetLocationModel.find({
      userId: userId,
      assetId: { $exists: true },
    }).lean();
  };

  getDataByAssetId = async (assetId: string) => {
    return await MapUserAssetLocationModel.find({
      assetId: assetId,
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
            { $match: { $expr: { $eq: ["$_id", "$$assetId"] }, visible: true } },
            { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } },
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
            { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_role: 1, user_status: 1, user_profile_img: 1 } },
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
          filter: { _id: helperService.validateObjectId(String(doc._id)) },
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
    session?: any
  ) => {
    const assetList = await AssetModel.find({
      locationId: helperService.validateObjectId(locationId),
    })
      .select("_id")
      .lean().session(session);
    for (const { _id } of assetList) {
      await this.updateUserMapping(String(_id), userIdList, [], [], session);
    }
  };

  updateUserMapping = async (assetId: string, userIdList: any, inheritedAdded: string[] = [], inheritedRemoved: string[] = [], session?: any) => {
    const assetUserMappings = await this.getDataByAssetId(assetId);
    const existingUsers = assetUserMappings.map((u: any) => String(u.userId));
    const addedUsers = userIdList.filter((id: any) => !existingUsers.includes(id));
    const removedUsers = existingUsers.filter((id: any) => !userIdList.includes(id));
    const effectiveAdded = Array.from([...new Set([...addedUsers, ...inheritedAdded])]);
    const effectiveRemoved = Array.from([...new Set([...removedUsers, ...inheritedRemoved])]);
    if (effectiveAdded.length > 0) {
      await this.addChildAssetMapping(assetId, effectiveAdded, session);
    }
    if (effectiveRemoved.length > 0) {
      await this.removeChildAssetMapping(assetId, effectiveRemoved, session);
    }
    const assetChildList = await AssetModel.find({ parent_id: helperService.validateObjectId(assetId) }).select("_id").lean().session(session);
    for (const { _id } of assetChildList) {
      const childExisting = await this.getDataByAssetId(String(_id));
      const childUserList = childExisting.map((d: any) => String(d.userId));
      await this.updateUserMapping(String(_id), childUserList, effectiveAdded, effectiveRemoved, session);
    }
  };

  updateFlagOnAssetUpdate = async (assetId: any, userIdList: string[], alarmType: string[], session?: any) => {
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
      { $set: newFlags },
      { session }
    );

    const assetChildList = await AssetModel.find({ parent_id: assetObjectId }).select("_id").lean().session(session);
    for (const { _id } of assetChildList) {
      await this.updateFlagOnAssetUpdate(String(_id), userIdList, alarmType, session);
    }

    return {
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified
    };
  };

  addChildAssetMapping = async (id: string, userIdList: string[], session?: any) => {
    const assetId = helperService.validateObjectId(id);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    const queryArray = userIds.map((userId) => {
      const mapData: any = {
        assetId: assetId,
        userId: userId,
      };
      return mapData;
    });
    await MapUserAssetLocationModel.insertMany(queryArray, { session });
  }

  removeChildAssetMapping = async (id: string, userIdList: string[], session?: any) => {
    const assetId = helperService.validateObjectId(id);
    const userIds = helperService.validateObjectIds(userIdList.join(','));
    await MapUserAssetLocationModel.deleteMany({
      assetId: assetId,
      userId: {
        $in: userIds,
      },
    }, { session });
  }

  removeAssetMapping = async (id: string, session?: any) => {
    return await MapUserAssetLocationModel.deleteMany({ assetId: id }, { session });
  }

  removeAssetListMapping = async (assetIdList: string[], session?: any) => {
    return await MapUserAssetLocationModel.deleteMany({
      assetId: { $in: assetIdList },
    }, { session });
  }
}

export const mapUserToAssetService = new MapUserToAssetService();

export const updateLocationAssetMapping = async (locationId: string, userIdList: string[], inheritedAdded: string[] = [], inheritedRemoved: string[] = [], session?: any) => {
  const locationObjectId = helperService.validateObjectId(locationId);
  const locationMappings = await MapUserAssetLocationModel.find({ locationId: locationObjectId, userId: { $exists: true } }).lean().session(session);
  const existingUsers = locationMappings.map(d => String(d.userId));
  const addedUsers = userIdList.filter(id => !existingUsers.includes(id));
  const removedUsers = existingUsers.filter(id => !userIdList.includes(id));
  const effectiveAdded = [...new Set([...addedUsers, ...inheritedAdded])];
  const effectiveRemoved = [...new Set([...removedUsers, ...inheritedRemoved])];
  if (effectiveAdded.length) {
    const effectiveAddedIds = helperService.validateObjectIds(effectiveAdded.join(','));
    await MapUserAssetLocationModel.insertMany(effectiveAddedIds.map(userId => ({ locationId: locationObjectId, userId: userId })), { ordered: false, session });
  }
  if (effectiveRemoved.length) {
    const effectiveRemovedIds = helperService.validateObjectIds(effectiveRemoved.join(','));
    await MapUserAssetLocationModel.deleteMany({ locationId: locationObjectId, userId: { $in: effectiveRemovedIds } }, { session });
  }
  const assets = await AssetModel.find({ locationId: locationObjectId }).select('_id').lean().session(session);
  for (const asset of assets) {
    const assetId = helperService.validateObjectId(String(asset._id));
    const assetMappings = await MapUserAssetLocationModel.find({ assetId, userId: { $exists: true } }).lean().session(session);
    const assetUsers = assetMappings.map(d => String(d.userId));
    const assetAdded = effectiveAdded.filter(id => !assetUsers.includes(id));
    const assetRemoved = effectiveRemoved.filter(id => assetUsers.includes(id));
    if (assetAdded.length) {
      const assetAddedIds = helperService.validateObjectIds(assetAdded.join(','));
      await MapUserAssetLocationModel.insertMany(assetAddedIds.map(userId => ({ assetId, userId: userId })), { ordered: false, session });
    }
    if (assetRemoved.length) {
      const assetRemovedIds = helperService.validateObjectIds(assetRemoved.join(','));
      await MapUserAssetLocationModel.deleteMany({ assetId, userId: { $in: assetRemovedIds } }, { session });
    }
    const childAssets = await AssetModel.find({ parent_id: assetId }).select('_id').lean().session(session);
    for (const child of childAssets) {
      const childAssetId = helperService.validateObjectId(String(child._id));
      const childMappings = await MapUserAssetLocationModel.find({ assetId: childAssetId, userId: { $exists: true } }).lean().session(session);
      const childUsers = childMappings.map(d => String(d.userId));
      await updateLocationAssetMapping(String(child._id), childUsers, assetAdded, assetRemoved, session);
    }
  }
  const childLocations = await LocationModel.find({ parent_id: locationObjectId }).select('_id').lean().session(session);
  for (const child of childLocations) {
    const childLocationId = helperService.validateObjectId(String(child._id));
    const childMappings = await MapUserAssetLocationModel.find({ locationId: childLocationId, userId: { $exists: true } }).lean().session(session);
    const childUsers = childMappings.map(d => String(d.userId));
    await updateLocationAssetMapping(String(child._id), childUsers, effectiveAdded, effectiveRemoved, session);
  }
};