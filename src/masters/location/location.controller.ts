import { Request, Response, NextFunction } from 'express';
import { getAll, insertLocation, updateById, removeById, getTree, kpiFilterLocations, childAssetsAgainstLocation, updateFloorMapImage, getLocationSensor } from './location.service';
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import { getDataByLocationId, getLocationsMappedData, mapUserLocationData } from '../../transaction/mapUserLocation/userLocation.service';
import mongoose from 'mongoose';
const moduleName: string = "location";

export const getLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    if (userRole !== 'admin') {
      const mappedUserList = await getLocationsMappedData(user_id);
      match.userIdList = { $in: mappedUserList.map((doc: any) => doc.userId) };
    }
    const { query: { locationId, parent_id }} = req;
    if (locationId) {
      match._id = { $in: locationId.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (parent_id) {
      match.parent_id = { $in: parent_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    let data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getLocationTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { query: { location_id, location_floor_map_tree } } = req;
    let match: any = { account_id, visible: true };
    let allowedLocationIds: any = [];
    if (location_floor_map_tree) {
      if (location_id) {
        match._id = location_id;
      }
    } else {
      if (location_id) {
        match._id = location_id;
      } else {
        match.parent_id = { $exists: false };
      }
    }
    if (userRole !== "admin") {
      const mapData = await getLocationsMappedData(user_id);
      allowedLocationIds = mapData?.map(doc => doc.locationId?.toString()) || [];
      if (allowedLocationIds.length === 0) {
        throw Object.assign(new Error("No data found"), { status: 404 });
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
    const data = await getTree(match, location_id, allowedLocationIds, userRole);
    if (!data || data.length === 0) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getKpiFilterLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data = await kpiFilterLocations(account_id, user_id, userRole);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getChildAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { levelOneLocations, levelTwoLocations } = req.body;
    const data = await childAssetsAgainstLocation(levelOneLocations, levelTwoLocations, account_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id }, query: { location_id, location_floor_map_tree } } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    let match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
    if (location_floor_map_tree) {
      match.top_level = true;
      if (location_id) {
        match._id = location_id;
      }
    } else {
      if (location_id) {
        match._id = location_id;
      }
    }
    if (userRole !== 'admin') {
      const mapData = await getLocationsMappedData(user_id);
      const allowedLocationIds = mapData?.map(doc => doc.locationId?.toString()) || [];
      if (allowedLocationIds.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
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
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].add_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const body = req.body;
    if (body.userIdList.length === 0) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    body.account_id = account_id;
    body.createdBy = user_id;
    const data: any = await insertLocation(body);
    await mapUserLocationData(data._id, body.userIdList, account_id);
    res.status(201).json({ status: true, message: "Data created successfully", data: [data] });
  } catch (error) {
    next(error);
  }
}

export const updateLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].edit_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    if (!body.userIdList || body.userIdList.length === 0 || body.userIdList.filter((doc: any) => doc).length === 0) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, account_id: account_id, visible: true };
    const location = await getAll(match);
    if (!location || location.length === 0 || !location[0].visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    body.updatedBy = user_id;
    const data: any = await updateById(id, body);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await mapUserLocationData(data._id, body.userIdList, account_id);
    data.id = data._id;
    res.status(200).json({ status: true, message: "Data updated successfully", data: [data] });
  } catch (error) {
    next(error);
  }
}

export const removeLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].delete_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    if (!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: req.params.id, account_id: account_id, visible: true };
    const location = await getAll(match);
    if (!location || location.length === 0 || !location[0].visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeById(req.params.id, location, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export const updateLocationFloorMapImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body: { top_level_location_image } } = req;
    if (!id || !top_level_location_image) {
      throw Object.assign(new Error('Invalid request data'), { status: 400 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    await updateFloorMapImage(id, account_id, user_id, top_level_location_image);
    res.status(200).json({ status: true, message: "Data updated successfully" });
  } catch (error) {
    next(error);
  }
}

export const getLocationSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data = await getLocationSensor(account_id, user_id, userRole);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createDuplicateLocation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].add_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, account_id: account_id, visible: true };
    const locationData = await getAll(match);
    if (!locationData || locationData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const body = locationData[0];
    const userList: any = await getDataByLocationId(id);
    if (!userList && userList.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    body.location_name = `${body.location_name} - copy`;
    body.userIdList = userList.map((doc: any) => doc.userId);
    body.account_id = account_id;
    body.createdBy = user_id;
    const data: any = await insertLocation(body);
    await mapUserLocationData(data._id, body.userIdList, account_id);
    res.status(201).json({ status: true, message: "Data created successfully", data: [data] });
  } catch (error) {
    next(error);
  }
}