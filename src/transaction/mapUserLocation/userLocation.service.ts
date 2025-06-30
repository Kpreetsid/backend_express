import { MapUserAssetLocation, IMapUserLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { LocationMaster } from "../../models/location.model";
import { Asset } from "../../models/asset.model";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAssetsMappedData = async (userId: string) => {
  return await MapUserAssetLocation.find({ userId: userId, assetId: { $exists: true } });
}

export const getLocationsMappedData = async (userId: string) => {
  return await MapUserAssetLocation.find({ userId: userId, locationId: { $exists: true } });
}

export const userLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { locationId: { $exists: true } };
    let populate: string | any;
    const filter: any = {};
    if (userRole === 'admin') {
      const locationMatch = { account_id: account_id, visible: true };
      const locationData = await getData(LocationMaster, { filter: locationMatch });
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
      const locationData = await getData(LocationMaster, { filter: locationMatch });
      if (!locationData || locationData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    if (query?.populate) {
      filter.populate = query.populate;
    }
    filter.filter = match;
    let data = await getData(MapUserAssetLocation, filter);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if (filter.populate === 'locationId') {
      data = data.map((doc: any) => {
        doc.location = doc.locationId;
        doc.locationId = doc.location._id;
        return doc;
      })
    } else if(filter.populate === 'userId') {
      data = data.map((doc: any) => {
        doc.user = doc.userId;
        doc.userId = doc.user._id;
        return doc;
      })
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
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

export const mapUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    const queryArray: any = [];
    body.forEach((doc: any) => {
      queryArray.push(new MapUserAssetLocation({
        locationId: doc.locationId,
        userId: doc.userId,
        account_id
      }));
    })
    const data = await MapUserAssetLocation.insertMany(queryArray);
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: queryArray });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateMappedUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
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
    console.error(error);
    next(error);
  }
}

export const userAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { assetId: { $exists: true } };
    if(userRole === 'admin') {
      const assetMatch = { account_id: account_id, visible: true };
      const assetData = await Asset.find(assetMatch);
      if (!assetData || assetData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match.assetId = { $in: assetData.map(doc => doc._id) };
    } else {
      match.userId = user_id;
    }
    if(query.assetId) {
      match.assetId = query.assetId;
      const assetMatch = { _id: query.assetId, account_id : account_id };
      const assetData = await Asset.find(assetMatch);
      if (!assetData || assetData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    const data = await MapUserAssetLocation.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};