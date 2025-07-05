import { UserLog, IUserLog } from "../../../models/userLogs.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../../models/user.model";

export const getAllUserLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data: IUserLog[] | null = await UserLog.find({accountId: account_id});
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);     
  }
};