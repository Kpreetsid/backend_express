import { Router, Request, Response, NextFunction } from 'express';
import { notificationController } from './notification.controller';
import { isAuthenticated } from '../_config/auth';
import { rateLimiter } from '../middlewares/rateLimits';

const router = Router();

// All notification routes require authentication
router.use(isAuthenticated);
router.use(rateLimiter.notificationLimiter);

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  notificationController.getNotifications(req as any, res).catch(next);
});

router.patch('/:id/status', (req: Request, res: Response, next: NextFunction) => {
  notificationController.markAsOpened(req as any, res).catch(next);
});

router.patch('/mark-all-opened', (req: Request, res: Response, next: NextFunction) => {
  notificationController.markAllAsOpened(req as any, res).catch(next);
});

router.post('/test-notification', (req: Request, res: Response, next: NextFunction) => {
  notificationController.testNotification(req, res).catch(next);
});

export default router;
