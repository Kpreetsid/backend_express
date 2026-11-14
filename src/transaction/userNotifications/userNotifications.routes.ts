import { NextFunction, Request, Response, Router } from 'express';
import { Types } from 'mongoose';
import { accountAccessService } from '../../_role/accountAccess.service';
import { userNotificationsController } from './userNotifications.controller';
import { failure } from './userNotifications.validator';

export const notificationPermission = (action: 'view' | 'edit') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const context = req as any;
    if (!context.user?.account_id || !Types.ObjectId.isValid(String(context.user.account_id))) {
      next(failure('Unauthorized access', 401));
      return;
    }
    if (!accountAccessService.isEffectivePermissionEnabled(context.roleMenu, 'master_admin_panel', 'view') ||
        !accountAccessService.isEffectivePermissionEnabled(context.roleMenu, 'asset_mail', action)) {
      next(failure('You do not have permission to access asset notifications', 403));
      return;
    }
    next();
  };

export function userNotificationRoutes(router: Router): void {
  router.get(
    '/user-notifications',
    notificationPermission('view'),
    (req, res, next) => userNotificationsController.getUserNotifications(req, res, next)
  );
  router.patch(
    '/user-notifications/:mappingId',
    notificationPermission('edit'),
    (req, res, next) => userNotificationsController.patchUserNotifications(req, res, next)
  );
  router.patch(
    '/user-notifications',
    notificationPermission('edit'),
    (req, res, next) => userNotificationsController.updateUserNotificationsByUser(req, res, next)
  );
  router.put(
    '/user-notifications',
    notificationPermission('edit'),
    (req, res, next) => userNotificationsController.updateUserNotificationsByUser(req, res, next)
  );
}

export default userNotificationRoutes;
