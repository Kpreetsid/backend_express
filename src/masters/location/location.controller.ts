import express, { Request, Response, NextFunction } from 'express';
import { getAll, insertLocation, updateById, removeById, getTree, kpiFilterLocations, childAssetsAgainstLocation, updateFloorMapImage } from './location.service';
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import { mapUserLocationData } from '../../transaction/mapUserLocation/userLocation.service';
import mongoose from 'mongoose';
const moduleName: string = "location";

export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { visible: true, account_id: account_id };
    if(userRole !== 'admin') {
      match.userId = user_id;
    }
    const query: any = req.query;
    if (query?.locationId) {
      match._id = query.locationId;
    }
    if (query?.parent_id) {
      match.parent_id = query.parent_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id));
    }
    if (query?._id) {
      match.parent_id = query._id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id));
    }
    let data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const getLocationTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getTree(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getKpiFilterLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await kpiFilterLocations(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getChildAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await childAssetsAgainstLocation(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { _id: req.params.id, account_id: account_id };
    if(userRole !== 'admin') {
      match.userId = user_id;
    }
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].add_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const body = req.body;
    if(body.userIdList.length === 0) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    body.account_id = account_id;
    body.createdBy = user_id;
    const data: any = await insertLocation(body);
    await mapUserLocationData(data._id, body.userIdList, account_id);
    res.status(201).json({ status: true, message: "Data created successfully", data: [data] });
  } catch (error: any) {
    next(error);
  }
}

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].edit_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    if(!body.userIdList || body.userIdList.length === 0 || body.userIdList.filter((doc: any) => doc).length === 0) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, account_id: account_id, visible: true };
    const location = await getAll(match);
    if(!location || location.length === 0 || !location[0].visible) {
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
  } catch (error: any) {
    next(error);
  }
}

export const removeLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role[moduleName].delete_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: req.params.id, account_id: account_id, visible: true };
    const location = await getAll(match);
    if(!location || location.length === 0 || !location[0].visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeById(req.params.id, location);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error: any) {
    next(error);
  }
}

export const updateLocationFloorMapImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await updateFloorMapImage(req, res, next);
  } catch (error: any) {
    next(error);
  }
}