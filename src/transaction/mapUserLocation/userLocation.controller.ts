import { Request, Response, NextFunction } from 'express';
import { mapUserToAssetService, mapUserToLocationService } from './userLocation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';
import { assetService } from '../../masters/asset/asset.service';
import { locationService } from '../../masters/location/location.service';

class MapUserAssetLocationController {

   async getUserLocations (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const query = req.query;
      const match: any = { locationId: { $exists: true } };
      const filter: any = { populate: "userId" };
      if (userRole === "admin") {
        const locationMatch = { account_id, visible: true };
        const locationData = await locationService.getLocationsList(locationMatch);
        if (!locationData?.length) {
          throw Object.assign(new Error("No data found"), { status: 404 });
        }
        match.locationId = { $in: locationData.map((doc) => doc._id) };
      }
      if (query.locationId) {
        const locationId = new mongoose.Types.ObjectId(query.locationId as string);
        match.locationId = locationId;
        const locationData = await locationService.getLocationsList({ _id: locationId, account_id });
        if (!locationData) {
          throw Object.assign(new Error("No data found"), { status: 404 });
        }
      }
      if (query?.populate) {
        filter.populate = query.populate;
      }
      const data = await mapUserToLocationService.userLocations(match, filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
   async getUserAssets (req: Request, res: Response, next: NextFunction): Promise<any> {
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
        const assetData = await assetService.getAllAssets(assetMatch);
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
      const data = await mapUserToAssetService.userAssets(match, populate);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
   async setUserAssets (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const body = req.body;
      const data = body.filter((doc: any) => doc.assetId && doc.userId);
      if(data.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      await mapUserToAssetService.createMapUserAssets(body);
      res.status(201).json({ message: 'Assets mapped successfully' });
    } catch (error) {
      next(error);
    }
  };
  
   async updateUserAssets (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { params: { assetId }, body } = req;
      if (!assetId || body.length === 0) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      await mapUserToAssetService.updateUserMapping(String(assetId), body.userIdList);
      res.status(201).json({ status: true, message: 'Assets mapped successfully' });
    } catch (error) {
      next(error);
    }
  }
  
   async setUserLocations (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = body.filter((doc: any) => doc.locationId && doc.userId);
      if(data.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      await mapUserToLocationService.mapUserLocations(data, account_id);
      res.status(201).json({ message: 'Locations mapped successfully' });
    } catch (error) {
      next(error);
    }
  };
  
   async updateUserLocations (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = await mapUserToLocationService.mapUserLocations(body, account_id);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: 'Locations mapped successfully' });
    } catch (error) {
      next(error);
    }
  };
  
   async updateSendMailFlag (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const body: { _id: string; sendMail: boolean }[] = req.body;
      if (!Array.isArray(body) || body.length === 0) {
        throw Object.assign(new Error('Invalid input: body must be a non-empty array'), { status: 400 });
      }
      await mapUserToAssetService.updateMappedUserFlags(body);
      return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const userLocationController = new MapUserAssetLocationController();