import { Router, Request, Response, NextFunction } from 'express';
import { notificationController } from './notification.controller';
import { rateLimiter } from '../middlewares/rateLimits';

const router = Router();

// Authentication is applied once at the mount point in app.ts.
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

if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_NOTIFICATION_TEST_ENDPOINT === 'true') {
  router.post('/test-notification', (req: Request, res: Response, next: NextFunction) => {
    notificationController.testNotification(req, res).catch(next);
  });
}

export default router;
