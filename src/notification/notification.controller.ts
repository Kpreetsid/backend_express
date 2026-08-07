import { Request, Response } from 'express';
import { notificationRepository } from './notification.service';
import { notificationService } from '../utils/notification.service';
import { requireActiveTenantUsers } from '../utils/tenant-users';

// Extend Request type to include user property from auth middleware
interface AuthRequest extends Request {
  user: {
    id: string;
    _id?: string;
    account_id: string;
    [key: string]: any;
  };
}

export class NotificationController {
  /**
   * Get notifications for the authenticated user
   */
  public async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query['limit'] as string) || 50;
      const skip = parseInt(req.query['skip'] as string) || 0;

      const notifications = await notificationRepository.getUserNotifications(userId, limit, skip);
      res.json({ success: true, data: notifications });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Mark a notification as opened
   */
  public async markAsOpened(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid notification ID' });
      }

      const updated = await notificationRepository.updateStatus(id, 'Opened', userId);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      return res.json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
  /**
   * Mark all notifications as opened for the authenticated user
   */
  public async markAllAsOpened(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;
      const result = await notificationRepository.markAllAsOpened(userId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Test endpoint to trigger a notification
   */
  public async testNotification(req: AuthRequest, res: Response) {
    try {
      const { userId, type, message, companyId } = req.body;
      const authenticatedUserId = req.user.id || req.user._id;
      const accountId = req.user.account_id;
      if (!authenticatedUserId || !accountId) {
        throw Object.assign(new Error('Authenticated account is required'), {
          status: 401
        });
      }
      if (companyId && String(companyId) !== String(accountId)) {
        throw Object.assign(
          new Error('Notification company does not match authenticated account'),
          { status: 403 }
        );
      }
      const targetUserId = userId || authenticatedUserId;
      await requireActiveTenantUsers([targetUserId], accountId);
      await notificationService.notifyUser(
        targetUserId,
        type || 'TEST_NOTIFICATION',
        message || 'This is a test notification',
        { entityId: 'test-123' },
        accountId
      );

      res.json({ success: true, message: 'Test notification triggered' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const notificationController = new NotificationController();
