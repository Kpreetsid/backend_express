import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getFloorMaps, insert, updateById, removeById, getCoordinates, floorMapAssetCoordinates, insertCoordinates, deleteCoordinates, getAllChildLocationsRecursive } from './floorMap.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getAllFloorMaps = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    // const match: any = { account_id: account_id, isActive: true };
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match.user_id = user_id;
    }
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
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    // const match: any = { _id: req.params.id, account_id: account_id, isActive: true };
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };


    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match.user_id = user_id;
    }
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
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = {};
    const { query: { location_id } } = req;
    if (location_id) {
      const childLocations = await getAllChildLocationsRecursive([location_id]);
      match.locationId = { $in: [location_id, ...childLocations] };
      match.data_type = 'location';
    } else {
      if (userRole !== "super_admin") {
        match.account_id = account_id;
        match.visible = true;
      }
      match.data_type = 'kpi';
    }
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match.user_id = user_id;
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
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match.user_id = user_id;
    }
    console.log({ account_id, user_id, userRole });
    await floorMapAssetCoordinates(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const setFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await insertCoordinates(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const removeFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const result = await deleteCoordinates(match);
    if (!result) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Coordinate removed successfully" });
  } catch (error) {
    next(error);
  }
}