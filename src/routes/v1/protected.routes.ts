import { Router } from 'express';
import { isAuthenticated } from '../../core/auth/auth.middleware';
import uploadRoutes from '../../modules/upload/routes/upload.routes';
import masterRoutes from './master.routes';
import workRoutes from '../../modules/work-orders/routes/work-orders.routes';
import reportsRoutes from '../../modules/reports/routes/report.routes';
import transactionRoutes from '../../modules/mappings/routes/mapping.routes';
import notificationRoutes from '../../modules/communications/routes/communication.routes';

export const createProtectedRouter = (): Router => {
  const router = Router();
  router.use('/upload', isAuthenticated, uploadRoutes());
  router.use('/master', isAuthenticated, masterRoutes());
  router.use('/work', isAuthenticated, workRoutes());
  router.use('/reports', isAuthenticated, reportsRoutes());
  router.use('/map', isAuthenticated, transactionRoutes());
  router.use('/notifications', isAuthenticated, notificationRoutes);
  return router;
};

export default createProtectedRouter;
