import { NextFunction, Request, Response } from 'express';
import {
  getUserNotifications,
  patchUserNotifications,
  updateUserNotificationsByUser
} from './userNotifications.service';

export class UserNotificationsController {
  async getUserNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = String((req as any).user.account_id);
      const result = await getUserNotifications(accountId, req.query.userId);
      res.status(200).json({ status: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async patchUserNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = String((req as any).user.account_id);
      if (req.body && (Array.isArray(req.body.mappings) || req.body.userId === req.params.mappingId)) {
        const result = await updateUserNotificationsByUser(accountId, {
          userId: req.params.mappingId,
          ...req.body
        });
        res.status(200).json(result);
      } else {
        const data = await patchUserNotifications(accountId, req.params.mappingId, req.body);
        res.status(200).json({ status: true, data });
      }
    } catch (error) {
      next(error);
    }
  }

  async updateUserNotificationsByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = String((req as any).user.account_id);
      const result = await updateUserNotificationsByUser(accountId, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const userNotificationsController = new UserNotificationsController();
