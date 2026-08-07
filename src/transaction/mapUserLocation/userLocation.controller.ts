import { Request, Response, NextFunction } from 'express';
import { mapUserToLocationService } from './userLocation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { locationService } from '../../masters/location/location.service';
import { requireActiveTenantUsers } from '../../utils/tenant-users';

const resolveAuthorizedLocationIds = async (
  accountId: unknown,
  actorId: unknown,
  userRole: string,
  requestedLocationIds?: unknown
) => {
  const requestedIds = requestedLocationIds
    ? helperService.validateObjectIds(requestedLocationIds)
    : undefined;
  const locationMatch: any = { account_id: accountId, visible: true };
  if (requestedIds) {
    locationMatch._id = { $in: requestedIds };
  }
  const tenantLocations = await locationService.getLocationsList(locationMatch);
  const tenantLocationIds = (tenantLocations || []).map((location: any) => location._id);
  if (
    requestedIds
    && new Set(tenantLocationIds.map(String)).size !== new Set(requestedIds.map(String)).size
  ) {
    throw Object.assign(new Error("Location not found"), { status: 404 });
  }
  if (userRole === "admin") {
    return tenantLocationIds;
  }

  const actorMappings = await mapUserToLocationService.getLocationsMappedData(actorId);
  const actorLocationIdSet = new Set(
    (actorMappings || []).map((mapping: any) => String(mapping.locationId))
  );
  return tenantLocationIds.filter((id: any) => actorLocationIdSet.has(String(id)));
};

class MapUserLocationController {

  async getUserLocations(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: actorId, user_role: userRole } = get(req, "user", {}) as IUser;
      const query: any = req.query;
      const authorizedLocationIds = await resolveAuthorizedLocationIds(
        account_id,
        actorId,
        userRole,
        query.locationId
      );
      if (!authorizedLocationIds.length) {
        throw Object.assign(new Error("Location not found"), { status: 404 });
      }
      const match: any = { locationId: { $in: authorizedLocationIds } };
      const filter: any = { populate: "userId" };
      if (query.userId) {
        const [tenantUserId] = await requireActiveTenantUsers([query.userId], account_id);
        match.userId = tenantUserId;
      }
      if (query?.populate) {
        filter.populate = query.populate;
      }
      const data = await mapUserToLocationService.userLocations(match, filter, account_id);
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
      const { account_id, _id: actorId, user_role: userRole } = get(req, "user", {}) as IUser;
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const completeData = body.filter((doc: any) => doc.locationId && doc.userId);
      if (completeData.length === 0 || completeData.length !== body.length) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      const locationIds = completeData.map((doc: any) => doc.locationId);
      const authorizedLocationIds = await resolveAuthorizedLocationIds(
        account_id,
        actorId,
        userRole,
        locationIds
      );
      if (new Set(authorizedLocationIds.map(String)).size !== new Set(locationIds.map(String)).size) {
        throw Object.assign(new Error("Location not found"), { status: 404 });
      }
      await requireActiveTenantUsers(
        completeData.map((doc: any) => doc.userId),
        account_id
      );
      const validatedData = completeData.map((doc: any) => ({
        locationId: helperService.validateObjectId(String(doc.locationId)),
        userId: helperService.validateObjectId(String(doc.userId))
      }));
      await mapUserToLocationService.mapUserLocations(validatedData, account_id);
      res.status(201).json({ message: 'User locations mapped successfully' });
    } catch (error) {
      next(error);
    }
  };

  async updateUserLocations(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: actorId, user_role: userRole } = get(req, "user", {}) as IUser;
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      if (!body.length || body.some((doc: any) => !doc.locationId || !doc.userId)) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      const locationIds = body.map((doc: any) => doc.locationId);
      const authorizedLocationIds = await resolveAuthorizedLocationIds(
        account_id,
        actorId,
        userRole,
        locationIds
      );
      if (new Set(authorizedLocationIds.map(String)).size !== new Set(locationIds.map(String)).size) {
        throw Object.assign(new Error("Location not found"), { status: 404 });
      }
      await requireActiveTenantUsers(
        body.map((doc: any) => doc.userId),
        account_id
      );
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
