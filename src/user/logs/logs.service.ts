import { UserLog, IUserLog } from "../../models/userLogs.model";
import { Request, Response, NextFunction } from 'express';

export const getAllUserLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data = await UserLog.find({account_id: account_id}).sort({ _id: -1 });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);     
  }
};