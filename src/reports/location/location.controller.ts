import express, { Request, Response, NextFunction } from 'express';
import { getAll, createLocationsReport, deleteLocationsReport } from './location.service';
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

export const deleteReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('Invalid request data'), { status: 400 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const result = await deleteLocationsReport(id, `${account_id}`);
    if (result.deletedCount === 0) {
      throw Object.assign(new Error('Report not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}