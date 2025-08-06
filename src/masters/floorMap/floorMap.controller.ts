import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getFloorMaps, insert, updateById, removeById, getCoordinates, floorMapAssetCoordinates, insertCoordinates, deleteCoordinates } from './floorMap.service';
import { IUser } from '../../models/user.model';

export const getAllFloorMaps = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, isActive: true };
    if (userRole !== 'admin') {
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
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, isActive: true };
    if (userRole !== 'admin') {
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
    console.log({ account_id, user_id, userRole });
    await getCoordinates(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getFloorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
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
    const { params: { id }} = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { _id: id, account_id: account_id };
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