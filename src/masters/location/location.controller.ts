import express, { Request, Response, NextFunction } from 'express';
import { getAll, insertLocation, updateById, removeById, getTree, kpiFilterLocations, childAssetsAgainstLocation, updateFloorMapImage } from './location.service';
import { get } from "lodash";
import { IUser } from "../../models/user.model";
const moduleName: string = "location";

export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const user = get(req, "user", {}) as IUser;
    const match: any = { visible: true, account_id: account_id };
    console.log(user);
    if(userRole !== 'admin') {
      match.userId = user_id;
    }
    const query: any = req.query;
    if (query?.parent_id) {
      match.parent_id = query.parent_id;
    }
    if (query?._id) {
      match.parent_id = query._id;
    }
    let data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getLocationTree = async (req: Request, res: Response, next: NextFunction) => {
  await getTree(req, res, next);
}

export const getKpiFilterLocations = async (req: Request, res: Response, next: NextFunction) => {
  await kpiFilterLocations(req, res, next);
}

export const getChildAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction) => {
  await childAssetsAgainstLocation(req, res, next);
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
  } catch (error) {
    console.error(error);
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
    body.account_id = account_id;
    body.createdBy = user_id;
    const data: any = await insertLocation(body);
    res.status(201).json({ status: true, message: "Data created successfully", data: [data] });
  } catch (error) {
    console.error(error);
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
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, account_id: account_id, visible: true };
    const location = await getAll(match);
    if(!location || location.length === 0 || !location[0].visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const body = req.body;
    body.updatedBy = user_id;
    const data: any = await updateById(id, body);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    data.id = data._id;
    res.status(200).json({ status: true, message: "Data updated successfully", data: [data] });
  } catch (error) {
    console.error(error);
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
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, account_id: account_id, visible: true };
    const location = await getAll(match);
    if(!location || location.length === 0 || !location[0].visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeById(id, location);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const updateLocationFloorMapImage = async (req: Request, res: Response, next: NextFunction) => {
  await updateFloorMapImage(req, res, next);
}