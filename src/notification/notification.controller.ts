import { Request, Response } from 'express';
import { notificationRepository } from './notification.service';

// Extend Request type to include user property from auth middleware
interface AuthRequest extends Request {
  user: {
    id: string;
    _id?: string;
    account_id?: string;
    [key: string]: any;
  };
}

const paginationValue = (value: unknown, fallback: number, maximum?: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
};

export class NotificationController {
  /**
   * Get notifications for the authenticated user
   */
  public async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;
      const limit = paginationValue(req.query.limit, 25, 100);
      const skip = paginationValue(req.query.skip, 0);

      const result = await notificationRepository.getUserNotifications(userId, limit, skip);
      res.json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount,
        pagination: { limit, skip, total: result.total }
      });
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
  public async testNotification(req: Request, res: Response) {
    try {
      const authRequest = req as AuthRequest;
      const userId = authRequest.user.id || authRequest.user._id;
      const companyId = authRequest.user.account_id;
      const { type, message } = req.body;
      const { notificationService } = require('../utils/notification.service');
      
      await notificationService.notifyUser(
        userId,
        type || 'TEST_NOTIFICATION',
        message || 'This is a test notification',
        { entityId: 'test-123' },
        companyId
      );

      res.json({ success: true, message: 'Test notification triggered' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const notificationController = new NotificationController();
