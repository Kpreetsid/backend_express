import { UserLog, IUserLog } from "../../_models/userLogs.model";
import { Request, Response, NextFunction } from 'express';

export const getAllUserLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await UserLog.find({}).sort({ _id: -1 });
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);     
  }
};