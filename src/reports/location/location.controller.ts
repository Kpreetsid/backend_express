import express, { Request, Response, NextFunction } from 'express';
import { getAll, createLocationsReport } from './location.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getLocationsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    if(userRole !== 'admin') {
      match.user_id = user_id;
    }
    const { locationId } = req.query;
    if(locationId) {
      match.location_id = locationId;
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
};

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    body.accountId = account_id;
    body.user_id = user_id;
    const data = await createLocationsReport(body);
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}