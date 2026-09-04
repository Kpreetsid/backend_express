import { controllerCache } from '../../../core/cache/controller-cache.service';

import { Request, Response, NextFunction } from 'express';
import { userLogsService } from '../services/logs.service';
import { get } from 'lodash';
import { IUser } from '../models/user.model';
import { helperService } from '../../../common/utils/object-id.helper';

class UserLogsController {
  async userLogs (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;

      const match: any = { account_id };
      let { userId, fromDate, toDate, statusCode } = req.query;
      if (userRole !== "admin") {
        match.userId = user_id;

        if (userId && String(userId) !== String(user_id)) {
          throw Object.assign(new Error('Users may view only their own activity logs'), { status: 403 });
        }
      } else if (userId) {
        match.userId = helperService.validateObjectId(String(userId));
      }
      if (statusCode) {
        const normalizedStatusCode = Number(statusCode);
        if (!Number.isInteger(normalizedStatusCode) || normalizedStatusCode < 100 || normalizedStatusCode > 599) {
          throw Object.assign(new Error('Invalid status code'), { status: 400 });
        }
        match.statusCode = normalizedStatusCode;
      }
      const today = new Date();
      const defaultFrom = new Date();
      defaultFrom.setDate(today.getDate() - 3);
      const startDate = fromDate ? new Date(String(fromDate)) : defaultFrom;
      const endDate = toDate ? new Date(String(toDate)) : today;
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw Object.assign(new Error("Invalid date format"), { status: 400 });
      }
      if (endDate < startDate || endDate.getTime() - startDate.getTime() > 31 * 24 * 60 * 60 * 1000) {
        throw Object.assign(new Error('Log date range must be between 0 and 31 days'), { status: 400 });
      }
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: startDate, $lte: inclusiveEndDate };
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

