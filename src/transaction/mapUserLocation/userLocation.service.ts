import { MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { LocationMaster } from "../../models/location.model";
import { Asset } from "../../models/asset.model";
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import mongoose from "mongoose";

export const getAssetsMappedData = async (userId: string) => {
  return await MapUserAssetLocation.find({ userId: userId, assetId: { $exists: true } });
}

export const getLocationsMappedData = async (userId: string) => {
  return await MapUserAssetLocation.find({ userId: userId, locationId: { $exists: true } });
}

export const userLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { locationId: { $exists: true } };
    const filter: any = { populate: 'userId' };
    if (userRole === 'admin') {
      const locationMatch = { account_id: account_id, visible: true };
      const locationData = await LocationMaster.find(locationMatch);
      if (!locationData || locationData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match.locationId = { $in: locationData.map(doc => doc._id) };
    } else {
      match.userId = user_id;
    }
    if (query.locationId) {
      match.locationId = query.locationId;
      const locationMatch = { _id: query.locationId, account_id: account_id };
      const locationData = await LocationMaster.find(locationMatch);
      if (!locationData || locationData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    if (query?.populate) {
      filter.populate = query.populate;
    }
    let data: any = await MapUserAssetLocation.find(match).populate(filter.populate);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if (filter.populate === 'locationId') {
      data = data.map((doc: any) => {
        doc = doc.toObject();
        doc.location = doc.locationId;
        doc.locationId = doc.location._id;
        return doc;
      })
    } else if (filter.populate === 'userId') {
      data = data.map((doc: any) => {
        doc = doc.toObject();
        doc.user = doc.userId;
        doc.userId = doc.user._id;
        return doc;
      })
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const mapUserLocationData = async (id: any, userIdList: any, account_id: any) => {
  await MapUserAssetLocation.deleteMany({ locationId: id });
  const queryArray: any = [];
  userIdList.forEach((doc: any) => {
    queryArray.push(new MapUserAssetLocation({
      locationId: id,
      userId: doc,
      account_id
    }));
  })
  return await MapUserAssetLocation.insertMany(queryArray);
}

export const createMapUserAssets = async (data: any): Promise<any> => {
  return await MapUserAssetLocation.insertMany(data);
};

export const mapUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocation({
        locationId: doc.locationId,
        userId: doc.userId,
        account_id
      }));
    })
    await MapUserAssetLocation.insertMany(queryArray);
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
      queryArray.push(new MapUserAssetLocation({
        locationId: doc.locationId,
        userId: doc.userId,
        account_id
      }));
    })
    await MapUserAssetLocation.insertMany(queryArray);
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: queryArray });
  } catch (error) {
    next(error);
  }
}

export const userAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { assetId: { $exists: true } };
    if(query?.userId) {
      match.userId = new mongoose.Types.ObjectId(query.userId as string);
    }
    if (userRole === 'admin') {
      const assetMatch: any = { account_id, visible: true };
      if (query.assetId) {
        assetMatch._id = new mongoose.Types.ObjectId(query.assetId as string);
      }
      const assetData = await Asset.find(assetMatch).select('_id');
      if (!assetData || assetData.length === 0) {
        throw Object.assign(new Error('No asset(s) found for admin'), { status: 404 });
      }
      match.assetId = { $in: assetData.map(doc => doc._id) };
    } else {
      match.userId = user_id;
      if (query.assetId) {
        match.assetId = new mongoose.Types.ObjectId(query.assetId as string);
      }
    }
    const pipeline: any[] = [{ $match: match }];
    if (query.populate === 'assetId') {
      pipeline.push({ $lookup: { from: 'asset_master', localField: 'assetId', foreignField: '_id', as: 'asset' }}, { $unwind: '$asset' });
    }
    const data = await MapUserAssetLocation.aggregate(pipeline);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No mapping data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: 'User asset mapping fetched successfully', data });
  } catch (error) {
    next(error);
  }
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
    await MapUserAssetLocation.bulkWrite(bulkOps);
    return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const removeAssetMapping = async (id: string) => {
  return await MapUserAssetLocation.deleteMany({ assetId: id });
}

export const removeLocationMapping = async (id: string) => {
  return await MapUserAssetLocation.deleteMany({ locationId: id });
}