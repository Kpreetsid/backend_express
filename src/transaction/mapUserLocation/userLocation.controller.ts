import { Request, Response, NextFunction } from 'express';
import { mapUserToLocationService } from './userLocation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { locationService } from '../../masters/location/location.service';

class MapUserLocationController {

  async getUserLocations(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const query: any = req.query;
      const match: any = { locationId: { $exists: true } };
      const filter: any = { populate: "userId" };
      if (userRole === "admin") {
        const locationMatch = { account_id, visible: true };
        const locationData = await locationService.getLocationsList(locationMatch);
        if (!locationData?.length) {
          throw Object.assign(new Error("Location not found"), { status: 404 });
        }
        match.locationId = { $in: locationData.map((doc) => doc._id) };
      }
      if (query.locationId) {
        const locationIds = helperService.validateObjectIds(query.locationId);
        match.locationId = { $in: locationIds };
        const locationData = await locationService.getLocationsList({ _id: { $in: locationIds }, account_id, visible: true });
        if (!locationData?.length) {
          throw Object.assign(new Error("Location not found"), { status: 404 });
        }
      }
      if (query?.populate) {
        filter.populate = query.populate;
      }
      const data = await mapUserToLocationService.userLocations(match, filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("User location mapping not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "User location mappings fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async setUserLocations(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedData = body.filter((doc: any) => doc.locationId && doc.userId).map((doc: any) => ({
        locationId: helperService.validateObjectId(String(doc.locationId)),
        userId: helperService.validateObjectId(String(doc.userId))
      }));
      if (validatedData.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      await mapUserToLocationService.mapUserLocations(validatedData, account_id);
      res.status(201).json({ message: 'User locations mapped successfully' });
    } catch (error) {
      next(error);
    }
  };

  async updateUserLocations(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedBody = body.map((doc: any) => ({
        locationId: helperService.validateObjectId(String(doc.locationId)),
        userId: helperService.validateObjectId(String(doc.userId))
      }));
      const data = await mapUserToLocationService.mapUserLocations(validatedBody, account_id);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Location mapping not updated'), { status: 404 });
      }
      res.status(201).json({ status: true, message: 'User location mappings updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const userLocationController = new MapUserLocationController();