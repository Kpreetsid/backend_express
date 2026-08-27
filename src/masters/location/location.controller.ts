import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { locationService } from './location.service';
import { assetService } from '../asset/asset.service';
import { get } from "lodash";
import { IUser, UserModel } from "../../models/user.model";
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { withTransaction } from "../../utils/transaction.helper";
import { LocationModel } from "../../models/location.model";
import { notificationService } from '../../utils/notification.service';

class LocationController {

  getLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { query: { locationId, parent_id, account_id } } = req;
      const baseFilter: any = {};
      if (helperService.hasValue(locationId)) baseFilter._id = { $in: helperService.validateObjectIds(String(locationId)) };
      if (helperService.hasValue(parent_id)) baseFilter.parent_id = { $in: helperService.validateObjectIds(String(parent_id)) };
      if (helperService.hasValue(account_id)) baseFilter.account_id = { $in: helperService.validateObjectIds(String(account_id)) };
      const filter: any = await applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, accountField: "account_id", mapping: "location", idField: "_id" });
      let data = await locationService.getAllLocations(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No locations found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Locations retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getLocationTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { query: { location_id, location_floor_map_tree } } = req;
      let match: any = { account_id, visible: true };
      let allowedLocationIds: any = [];
      if (location_floor_map_tree) {
        if (helperService.hasValue(location_id)) {
          match._id = helperService.validateObjectId(String(location_id));
        }
      } else {
        if (helperService.hasValue(location_id)) {
          match._id = helperService.validateObjectId(String(location_id));
        } else {
          match.parent_id = { $exists: false };
        }
      }
      if (userRole !== "admin") {
        const mapData = await mapUserToLocationService.getLocationsMappedData(user_id);
        allowedLocationIds = mapData?.map(doc => doc.locationId?.toString()) || [];
        if (allowedLocationIds.length === 0) {
          throw Object.assign(new Error("Location Tree not found"), { status: 404 });
        }
        if (match._id) {
          const isAllowed = allowedLocationIds.includes(match._id.toString());
          if (!isAllowed) {
            throw Object.assign(new Error("No access to this location"), { status: 403 });
          }
        } else {
          match._id = { $in: allowedLocationIds };
        }
      }
      const data = await locationService.getTree(match, location_id, allowedLocationIds, userRole);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Location tree not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Location tree retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getChildLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
      const isDataExists = await locationService.getAllLocations(match);
      if (!isDataExists?.length) {
        throw Object.assign(new Error('Location not found'), { status: 404 });
      }
      const childIds = await this.getChildLocationByRecursive(String(id), account_id);
      const data = await locationService.getAllLocations({ _id: { $in: childIds }, account_id, visible: true });
      if (!data?.length) {
        throw Object.assign(new Error('Child location not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Child locations fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getChildLocationByRecursive = async (id: string, account_id?: any): Promise<string[]> => {
    const locationIdList: string[] = [id];
    const match: any = { parent_id: helperService.validateObjectId(String(id)), visible: true };
    if (account_id) match.account_id = account_id;
    const children = await locationService.getAllLocations(match);
    for (const child of children || []) {
      const childIds = await this.getChildLocationByRecursive(child.id.toString(), account_id);
      locationIdList.push(...childIds);
    }
    return locationIdList;
  };

  getKpiFilterLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const data = await locationService.kpiFilterLocations(account_id, user_id, userRole);
      if (!data) {
        throw Object.assign(new Error('KPI filter locations not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "KPI filter locations fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getChildAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { levelOneLocations, levelTwoLocations } = req.body;
      const data = await locationService.childAssetsAgainstLocation(levelOneLocations, levelTwoLocations, account_id, user_id, userRole);
      if (!data) {
        throw Object.assign(new Error('Child assets against location not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Child assets against location fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { params: { id }, query: { location_id, location_floor_map_tree } } = req;
      let match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
      if (location_floor_map_tree) {
        match.top_level = true;
        if (helperService.hasValue(location_id)) {
          match._id = helperService.validateObjectId(String(location_id));
        }
      } else {
        if (helperService.hasValue(location_id)) {
          match._id = helperService.validateObjectId(String(location_id));
        }
      }
      if (userRole !== 'admin') {
        const mapData = await mapUserToLocationService.getLocationsMappedData(user_id);
        const allowedLocationIds = mapData?.map(doc => doc.locationId?.toString()) || [];
        if (allowedLocationIds.length === 0) {
          throw Object.assign(new Error("Location not found"), { status: 404 });
        }
        if (match._id) {
          const isAllowed = allowedLocationIds.includes(match._id.toString());
          if (!isAllowed) {
            throw Object.assign(new Error('No access to this location'), { status: 403 });
          }
        } else {
          match._id = { $in: allowedLocationIds };
        }
      }
      const data = await locationService.getAllLocations(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Location not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Location retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  }

  createLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = { ...(req.body || {}) };
      body.userIdList = await this.assertAccountUsers(body.userIdList, account_id);
      delete body.account_id;
      delete body.createdBy;
      delete body.updatedBy;
      delete body.visible;

      if (body.parent_id) {
        const parent: any = await LocationModel.findOne({
          _id: helperService.validateObjectId(String(body.parent_id)),
          account_id,
          visible: true,
        }).select('_id location_name top_level top_level_location_id');
        if (!parent) {
          throw Object.assign(new Error('Parent location not found'), { status: 400 });
        }
        body.parent_id = parent._id;
        body.parent_name = parent.location_name;
        body.top_level = false;
        body.top_level_location_id = parent.top_level
          ? parent._id
          : (parent.top_level_location_id || parent._id);
      } else {
        body.top_level = true;
        delete body.parent_id;
        delete body.parent_name;
        delete body.top_level_location_id;
      }
      body.account_id = account_id;
      body.createdBy = user_id;
      const data: any = await locationService.insertLocation(body);
      await mapUserToLocationService.mapUserLocationData(data._id, body.userIdList, account_id);

      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Location',
        event: 'created',
        entityId: String(data._id),
        entityName: data.location_name,
        actionUrl: `/locations/info/${data._id}`,
        sourceUserId: String(user_id)
      });

      res.status(201).json({ status: true, message: "Location created successfully", data: [data] });
    } catch (error) {
      next(error);
    }
  }

  updateLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const body = { ...(req.body || {}) };
      body.userIdList = await this.assertAccountUsers(body.userIdList, account_id);
      delete body.account_id;
      delete body.createdBy;
      delete body.updatedBy;
      delete body.visible;
      delete body.top_level;
      delete body.parent_id;
      delete body.parent_name;
      delete body.top_level_location_id;
      const location = await locationService.getAllLocations({ _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true });
      if (!location || location.length === 0) {
        throw Object.assign(new Error('Location not found'), { status: 404 });
      }
      body.updatedBy = user_id;
      const data: any = await locationService.updateById(String(id), body, account_id);
      if (!data || !data.visible) {
        throw Object.assign(new Error('Failed to update location'), { status: 500 });
      }
      data.id = data._id;
      const updatedLocation = await locationService.getAllLocations({ _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true });

      const locationName = updatedLocation?.[0]?.location_name || 'Location';
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Location',
        event: 'updated',
        entityId: String(id),
        entityName: locationName,
        actionUrl: `/locations/info/${id}`,
        sourceUserId: String(user_id)
      });

      res.status(200).json({ status: true, message: "Location updated successfully", data: updatedLocation });
    } catch (error) {
      next(error);
    }
  }

  removeLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match = { _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true };
      const location = await locationService.getAllLocations(match);
      if (!location || location.length === 0 || !location[0].visible) {
        throw Object.assign(new Error('Location not found'), { status: 404 });
      }
      await locationService.removeLocationById(helperService.validateObjectId(String(id)), user_id, account_id);
      res.status(200).json({ status: true, message: "Location deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  updateLocationFloorMapImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { params: { id }, body: { top_level_location_image } } = req;
      if (!id || !top_level_location_image) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      await locationService.updateFloorMapImage(String(id), account_id, user_id, top_level_location_image);
      res.status(200).json({ status: true, message: "Location floor map image updated successfully" });
    } catch (error) {
      next(error);
    }
  }

  getLocationSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const data = await locationService.getLocationSensor(account_id, user_id, userRole);
      res.status(200).json({ status: true, message: "Location sensor list fetched successfully", data: data || [] });
    } catch (error) {
      next(error);
    }
  }

  createDuplicateLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;

      const result = await withTransaction(async (session: any) => {
        let sourceLocation: any = await LocationModel.findOne({ _id: helperService.validateObjectId(String(id)), account_id, visible: true }).session(session);
        if (!sourceLocation) {
          throw Object.assign(new Error("Location not found"), { status: 404 });
        }
        this.assertRolePermission(req, 'location', sourceLocation.top_level || !sourceLocation.parent_id
          ? 'add_location'
          : 'add_child_location');
        sourceLocation = sourceLocation.toObject();

        const allChildren: any[] = await locationService.getAllChildHierarchy(helperService.validateObjectId(String(id)), account_id);
        const idMap: Record<string, any> = {};
        const parentForCopy = sourceLocation.parent_id ? sourceLocation.parent_id : undefined;

        // Clone the root location node
        const newParentId = await locationService.cloneLocationNode(sourceLocation, user_id, account_id, parentForCopy, idMap, null, session);
        const newTopLevelId = sourceLocation.parent_id ? sourceLocation.top_level_location_id : newParentId;
        idMap[`${sourceLocation._id}`] = newParentId;

        // Clone all child location nodes
        if (allChildren.length > 0) {
          for (const child of allChildren) {
            const childObj = child.toObject ? child.toObject() : child;
            const newParent = idMap[childObj.parent_id?.toString()] || newParentId;
            const newChildId = await locationService.cloneLocationNode(childObj, user_id, account_id, newParent, idMap, newTopLevelId, session);
            idMap[childObj._id.toString()] = newChildId;
          }
        }

        // Clone assets for each location in the new hierarchy
        const userToken = get(req, "userToken", "") as string;
        for (const [oldLocId, newLocId] of Object.entries(idMap)) {
          await assetService.cloneAssetsByLocation(oldLocId, newLocId, account_id, user_id, userToken, session);
        }

        // Fetch the newly created top-level location with all its details
        const getData = await locationService.getAllLocations({ _id: newParentId, account_id, visible: true });
        return getData;
      });

      res.status(201).json({ status: true, message: "Location hierarchy copied successfully", data: result });
    } catch (error) {
      next(error);
    }
  };

  private assertRolePermission(req: Request, moduleName: string, action: string): void {
    const roleMenu: any = get(req, 'role', {});
    if (roleMenu?.[moduleName]?.[action] !== true) {
      throw Object.assign(new Error('You do not have permission to access.'), { status: 403 });
    }
  }

  private async assertAccountUsers(userIdList: unknown, accountId: any): Promise<string[]> {
    if (!Array.isArray(userIdList) || userIdList.length === 0) {
      throw Object.assign(new Error('User selection is required for location mapping'), { status: 400 });
    }
    const uniqueIds = Array.from(new Set(userIdList.map(String).map(id => id.trim()).filter(Boolean)));
    const objectIds = helperService.validateObjectIds(uniqueIds, 500);
    const count = await UserModel.countDocuments({ _id: { $in: objectIds }, account_id: accountId });
    if (count !== objectIds.length) {
      throw Object.assign(new Error('Every selected user must belong to the active account'), { status: 400 });
    }
    return objectIds.map(id => String(id));
  }
}

export const locationController = controllerCache.withCache(new LocationController(), { namespace: 'locations', ttlSeconds: 300, tags: ['locations', 'assets', 'equipment', 'work'], skipMethods: ['getChildLocationByRecursive'] });
