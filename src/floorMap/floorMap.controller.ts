import express, { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getFloorMaps, insert, updateById, removeById, getCoordinates, floorMapAssetCoordinates, insertCoordinates } from './floorMap.service';
import { IUser } from '../models/user.model';

export const getAllFloorMaps = async (req: Request, res: Response, next: NextFunction) => {
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
    console.error(error);
    next(error);
  }
}

export const getFloorMapByID = async (req: Request, res: Response, next: NextFunction) => {
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
    console.error(error);
    next(error);
  }
}

export const createFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}

export const getFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  await getCoordinates(req, res, next);
}

export const getFloorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  await floorMapAssetCoordinates(req, res, next);
}

export const setFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  await insertCoordinates(req, res, next);
}