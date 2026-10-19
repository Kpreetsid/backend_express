import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { mapUserToLocationService } from './userLocation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { locationService } from '../../masters/location/location.service';
import { LocationModel } from '../../models/location.model';
import { UserModel } from '../../models/user.model';
import { applyRoleFilter } from '../../utils/roleFilter';

class MapUserLocationController {
  private async validateReferences(body: any[], user: IUser): Promise<void> {
    const locationIds = [...new Set(body.map(item => String(item.locationId)))];
    const userIds = [...new Set(body.map(item => String(item.userId)))];
    const locationFilter = await applyRoleFilter({ user, baseFilter: { _id: { $in: locationIds } }, mapping: 'location' });
    const [locations, users] = await Promise.all([
      LocationModel.countDocuments(locationFilter),
      UserModel.countDocuments({ _id: { $in: userIds }, account_id: user.account_id, user_status: 'active' })
    ]);
    if (locations !== locationIds.length || users !== userIds.length) {
      throw Object.assign(new Error('Mapping reference is unavailable or outside your scope'), { status: 403 });
    }
  }


  async getUserLocations(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, 'user', {}) as IUser;
      const locationMatch: any = { account_id, visible: true };
      if (req.query.locationId) locationMatch._id = { $in: helperService.validateObjectIds(String(req.query.locationId)) };
      const locations = await locationService.getLocationsList(locationMatch);
      const match: any = {
        locationId: { $in: locations.map(location => location._id) },
        $or: [{ account_id }, { account_id: { $exists: false } }]
      };
      if (userRole === 'admin') {
        const users = await UserModel.find({ account_id, user_status: 'active' }).select('_id').lean();
        match.userId = { $in: users.map(item => item._id) };
      } else {
        match.userId = user_id;
      }
      const filter = { populate: req.query.populate === 'locationId' ? 'locationId' : 'userId' };
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
      await this.validateReferences(validatedData, get(req, 'user', {}) as IUser);
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
      await this.validateReferences(validatedBody, get(req, 'user', {}) as IUser);
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

export const userLocationController = controllerCache.withCache(new MapUserLocationController(), { namespace: 'mappings', ttlSeconds: 120, tags: ['mappings', 'assets', 'locations', 'work-orders', 'users'] });
