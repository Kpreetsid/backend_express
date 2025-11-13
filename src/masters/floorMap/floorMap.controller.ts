import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getFloorMaps, insert, updateById, removeById, getCoordinates, insertCoordinates, deleteCoordinates, getAllChildLocationsRecursive } from './floorMap.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getAllFloorMaps = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    const data = await getFloorMaps(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}


export const getFloorMapByID = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(req.params.id), account_id };
    const data = await getFloorMaps(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createFloorMap = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await insert(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updateFloorMap = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await updateById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const removeFloorMap = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await removeById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    const { query: { location_id } } = req;
    if (location_id) {
      const childLocations = await getAllChildLocationsRecursive([location_id]);
      match.locationId = { $in: [location_id, ...childLocations] };
      match.data_type = 'location';
    } else {
      match.data_type = 'kpi';
    }
    const data = await getCoordinates(match, account_id);
    if (!data || data.length == 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: `Data found Successfully.`, data })
  } catch (error) {
    next(error);
  }
}

export const getFloorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id: location_id } = req.params;
    if (!location_id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { account_id };
    if (location_id) {
      match.data_type = "asset";
      match.locationId = location_id.toString();
    }
    const data: any[] = await getFloorMaps(match);
    if (!data || data.length == 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: `Data found Successfully.`, data })
  } catch (error) {
    next(error);
  }
}

export const setFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    if (!body.coordinate) {
      throw Object.assign(new Error('Coordinate is required'), { status: 400 });
    }
    const match: any = { account_id };
    if (body.data_type === 'asset' && !body.end_point_id) {
      throw Object.assign(new Error('End point is required'), { status: 400 });
    } else {
      match.end_point_id = body.end_point_id;
    }
    if (body.data_type === 'kpi' && !body.locationId) {
      throw Object.assign(new Error('Location is required'), { status: 400 });
    } else {
      match.locationId = body.locationId;
    }
    const existEndPoint = await getFloorMaps(match);
    if (existEndPoint && existEndPoint.length > 0) {
      throw Object.assign(new Error('End point already exist'), { status: 400 });
    }
    const data = await insertCoordinates(body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('Failed to set coordinates'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Coordinates added successfully", data });
  } catch (error) {
    next(error);
  }
}

export const removeFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    const result = await deleteCoordinates(match);
    if (!result) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Coordinate removed successfully" });
  } catch (error) {
    next(error);
  }
}