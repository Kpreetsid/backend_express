import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import mongoose from "mongoose";

export const getAssetsMappedData = async (userId: string) => {
  return await MapUserAssetLocationModel.find({ userId: userId, assetId: { $exists: true } });
}

export const getLocationsMappedData = async (userId: any) => {
  return await MapUserAssetLocationModel.find({ userId: userId, locationId: { $exists: true } });
}

export const getDataByLocationId = async (locationId: string) => {
  return await MapUserAssetLocationModel.find({ locationId: locationId });
}

export const getDataByAssetId = async (assetId: string) => {
  return await MapUserAssetLocationModel.find({ assetId: assetId });
}

export const userLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { locationId: { $exists: true } };
    const filter: any = { populate: "userId" };
    if (userRole === "admin") {
      const locationMatch = { account_id, visible: true };
      const locationData = await LocationModel.find(locationMatch);
      if (!locationData?.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      match.locationId = { $in: locationData.map((doc) => doc._id) };
    } else {
      match.userId = user_id;
    }
    if (query.locationId) {
      const locationId = new mongoose.Types.ObjectId(query.locationId as string);
      match.locationId = locationId;
      const locationData = await LocationModel.findOne({ _id: locationId, account_id });
      if (!locationData) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
    }
    if (query?.populate) {
      filter.populate = query.populate;
    }
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
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const createMapUserAssets = async (data: any): Promise<any> => {
  return await MapUserAssetLocationModel.insertMany(data);
};

const updateAssetsForLocationHierarchy = async (locationId: string, userIdList: string[]) => {
  const assets = await AssetModel.find({ locationId: locationId }).select("_id").lean();
  for (const asset of assets) {
    await updateMapUserAssets(asset._id.toString(), userIdList);
  }
  const childLocations = await LocationModel.find({ parent_id: locationId }).select("_id").lean();
  for (const child of childLocations) {
    await updateAssetsForLocationHierarchy(child._id.toString(), userIdList);
  }
};

const getAllChildLocations = async (locationId: string, userIdList: string[]) => {
  const children = await LocationModel.find({ parent_id: locationId }).select("_id").lean();
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
  await Promise.all(childIds.map(async (id: string) => await getAllChildLocations(id, userIdList)));
}

export const mapUserLocationData = async (id: any, userIdList: any, account_id: any) => {
  await getAllChildLocations(id, userIdList);
  await MapUserAssetLocationModel.deleteMany({ locationId: id });
  const queryArray: any = [];
  userIdList.forEach((doc: any) => {
    queryArray.push(new MapUserAssetLocationModel({
      locationId: id,
      userId: doc,
      account_id
    }));
  })
  await updateAssetsForLocationHierarchy(id, userIdList);
  return await MapUserAssetLocationModel.insertMany(queryArray);
}

const getAllChildAssets = async (assetId: string, userIdList: string[]) => {
  const children = await AssetModel.find({ parent_id: assetId }).select("_id").lean();
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
    await getAllChildAssets(childId, userIdList);
  }
};

export const updateMapUserAssets = async (assetId: string, userIdList: string[]): Promise<any> => {
  await getAllChildAssets(assetId, userIdList);
  await MapUserAssetLocationModel.deleteMany({ assetId });
  if (userIdList.length > 0) {
    const queryArray = userIdList.map(userId => ({ assetId, userId }));
    await MapUserAssetLocationModel.insertMany(queryArray);
  }
  return assetId;
};

export const mapUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({ locationId: doc.locationId, userId: doc.userId, account_id }));
    })
    await MapUserAssetLocationModel.insertMany(queryArray);
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: queryArray });
  } catch (error) {
    next(error);
  }
};

export const updateMappedUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocationModel({ locationId: doc.locationId, userId: doc.userId, account_id }));
    })
    await MapUserAssetLocationModel.insertMany(queryArray);
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: queryArray });
  } catch (error) {
    next(error);
  }
}

export const userAssets = async (match: any, populate: any): Promise<any> => {
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

export const updateMappedUserFlags = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const body: { _id: string; sendMail: boolean }[] = req.body;
    if (!Array.isArray(body) || body.length === 0) {
      throw Object.assign(new Error('Invalid input: body must be a non-empty array'), { status: 400 });
    }
    const bulkOps = body.map(doc => {
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
    await MapUserAssetLocationModel.bulkWrite(bulkOps);
    return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const removeAssetMapping = async (id: string) => {
  return await MapUserAssetLocationModel.deleteMany({ assetId: id });
}

export const removeLocationMapping = async (id: string) => {
  return await MapUserAssetLocationModel.deleteMany({ locationId: id });
}

export const removeLocationListMapping = async (locationIdList: string[]) => {
  return await MapUserAssetLocationModel.deleteMany({ locationId: { $in: locationIdList } });
}

export const removeAssetListMapping = async (assetIdList: string[]) => {
  return await MapUserAssetLocationModel.deleteMany({ assetId: { $in: assetIdList } });
}