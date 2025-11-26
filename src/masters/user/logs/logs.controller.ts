import { Request, Response, NextFunction } from 'express';
import { getAllUserLogs } from './logs.service';
import { get } from 'lodash';
import { IUser } from '../../../models/user.model';
import mongoose from 'mongoose';

export const userLogs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    let { userId, fromDate, toDate, statusCode } = req.query;
    if (userRole !== "admin") {
      match.userId = user_id;
    }
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        return next(Object.assign(new Error("Invalid userId"), { status: 400 }));
      }
      match.userId = new mongoose.Types.ObjectId(String(userId));
    }
    if (statusCode) {
      match.statusCode = statusCode;
    }
    const today = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(today.getDate() - 3);
    const startDate = fromDate ? new Date(String(fromDate)) : defaultFrom;
    const endDate = toDate ? new Date(String(toDate)) : today;
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw Object.assign(new Error("Invalid date format"), { status: 400 });
    }
    match.createdAt = { $gte: startDate, $lte: `${new Date(endDate).toISOString().split('T')[0]}T23:59:59.999Z` };
    const data = await getAllUserLogs(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};
