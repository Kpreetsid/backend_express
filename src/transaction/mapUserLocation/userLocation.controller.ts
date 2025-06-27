import express, { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { userLocations, userAssets, mapUserLocations, updateMappedUserLocations } from './userLocation.service';
import { IUser } from '../../models/user.model';

export const getUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await userLocations(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getUserAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await userAssets(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const setUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    const locationIdList = body.map((doc: any) => doc.locationId);
    const userIdList = body.map((doc: any) => doc.userId);
    if(locationIdList.length !== userIdList.length) {
      throw Object.assign(new Error('Invalid data'), { status: 400 });
    }
    await mapUserLocations(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await updateMappedUserLocations(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
};