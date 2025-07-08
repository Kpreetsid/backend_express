import express, { Request, Response, NextFunction } from 'express';
import { getAll, createLocationsReport, deleteLocationsReport } from './location.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getLocationsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    const { locationId } = req.query;
    if(userRole !== 'admin') {
      match.user_id = user_id;
    }
    if(locationId) {
      match.location_id = locationId;
    }
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
};

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { location_id, top_level } = req.body;
    if (!location_id || !top_level) {
      throw Object.assign(new Error('Invalid request data'), { status: 400 });
    }
    const match = { account_id, location_id, top_level, user_id };
    const data = await createLocationsReport(match);
    if(!data) {
      throw Object.assign(new Error('Something went wrong'), { status: 500 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const deleteReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { params: { id }} = req;
    if (!id) {
      throw Object.assign(new Error('Invalid request data'), { status: 400 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const result = await deleteLocationsReport(id, `${account_id}`, `${user_id}`);
    if (!result) {
      throw Object.assign(new Error('Report not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Report deleted successfully" });
  } catch (error: any) {
    next(error);
  }
}