import { controllerCache } from '../../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { userLogsService } from './logs.service';
import { get } from 'lodash';
import { IUser } from '../../../models/user.model';
import { helperService } from '../../../utils/helper';

class UserLogsController {
  async userLogs (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id };
      let { userId, fromDate, toDate, statusCode } = req.query;
      if (userRole !== "admin") {
        match.userId = user_id;
      }
      if (userId) {
        match.userId = helperService.validateObjectId(String(userId));
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
      const data = await userLogsService.getAllUserLogs(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Log data not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
}

export const userLogsController = controllerCache.withCache(new UserLogsController(), { namespace: 'user-logs', ttlSeconds: 30, tags: ['user-logs'], readMethods: ['userLogs'] });
