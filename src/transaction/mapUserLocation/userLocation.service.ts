import { MapUserAssetLocation, IMapUserLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { LocationMaster } from "../../models/location.model";
import { Asset } from "../../models/asset.model";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const userLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { locationId: { $exists: true } };
    if(userRole === 'admin') {
      const locationMatch = { account_id: account_id, visible: true };
      const locationData = await getData(LocationMaster, { filter: locationMatch });
      if (!locationData || locationData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match.locationId = { $in: locationData.map(doc => doc._id) };
    } else {
      match.userId = user_id;
    }
    if(query.locationId) {
      match.locationId = query.locationId;
      const locationMatch = { _id: query.locationId, account_id : account_id };
      const locationData = await getData(LocationMaster, { filter: locationMatch });
      if (!locationData || locationData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    const data = await getData(MapUserAssetLocation, { filter: match, populate: 'locationId' });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const userAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { assetId: { $exists: true } };
    if(userRole === 'admin') {
      const assetMatch = { account_id: account_id, visible: true };
      const assetData = await getData(Asset, { filter: assetMatch });
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
      const assetData = await getData(Asset, { filter: assetMatch });
      if (!assetData || assetData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    const data = await getData(MapUserAssetLocation, { filter: match, populate: 'assetId' });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};