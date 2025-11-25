import { Request, Response, NextFunction } from 'express';
import { userLocations, userAssets, mapUserLocations, updateMappedUserLocations, updateMappedUserFlags, createMapUserAssets, updateMapUserAssets } from './userLocation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';
import { getAllAssets } from '../../masters/asset/asset.service';
import { getLocationsList } from '../../masters/location/location.service';

export const getUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { locationId: { $exists: true } };
    const filter: any = { populate: "userId" };
    if (userRole === "admin") {
      const locationMatch = { account_id, visible: true };
      const locationData = await getLocationsList(locationMatch);
      if (!locationData?.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      match.locationId = { $in: locationData.map((doc) => doc._id) };
    }
    if (query.locationId) {
      const locationId = new mongoose.Types.ObjectId(query.locationId as string);
      match.locationId = locationId;
      const locationData = await getLocationsList({ _id: locationId, account_id });
      if (!locationData) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
    }
    if (query?.populate) {
      filter.populate = query.populate;
    }
    const data = await userLocations(match, filter);
    if (!data || data.length === 0) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getUserAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { userId, assetId, populate } = req.query;
    const match: any = { assetId: { $exists: true } };
    if(userId) {
      match.userId = new mongoose.Types.ObjectId(userId as string);
    }
    if (userRole === 'admin') {
      const assetMatch: any = { account_id, visible: true };
      if (assetId) {
        assetMatch._id = new mongoose.Types.ObjectId(assetId as string);
      }
      const assetData = await getAllAssets(assetMatch);
      if (!assetData || assetData.length === 0) {
        throw Object.assign(new Error('No assets found'), { status: 404 });
      }
      match.assetId = { $in: assetData.map((doc: any) => doc._id || doc.id) };
    } else {
      match.userId = user_id;
      if (assetId) {
        match.assetId = new mongoose.Types.ObjectId(assetId as string);
      }
    }
    const data = await userAssets(match, populate);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const setUserAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const body = req.body;
    const data = body.filter((doc: any) => doc.assetId && doc.userId);
    if(data.length === 0) {
      throw Object.assign(new Error('Invalid data'), { status: 400 });
    }
    await createMapUserAssets(body);
    res.status(201).json({ message: 'Assets mapped successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateUserAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { assetId }, body } = req;
    if (!assetId || body.length === 0) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const data = await updateMapUserAssets(assetId, body);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: 'Assets mapped successfully' });
  } catch (error) {
    next(error);
  }
}

export const setUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const body = req.body;
    const data = body.filter((doc: any) => doc.locationId && doc.userId);
    if(data.length === 0) {
      throw Object.assign(new Error('Invalid data'), { status: 400 });
    }
    await mapUserLocations(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const updateUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const data = await updateMappedUserLocations(body, account_id);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: 'Locations mapped successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateSendMailFlag = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateMappedUserFlags(req, res, next);
  } catch (error) {
    next(error);
  }
};