import { UserLog, IUserLog } from "../../_models/userLogs.model";
import { Request, Response, NextFunction } from 'express';

export const getAllUserLogs = async (req: Request, res: Response, next: NextFunction): Promise<IUserLog[]> => {
  try {
    return await UserLog.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};