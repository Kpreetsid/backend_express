import { Router } from 'express';
import assetRoutes from './asset.routes';
import locationRoutes from './location.routes';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';

export const createReportsRouter = (): Router => {
  const router = Router();
  router.use(rateLimiter.reportLimiter);
  const assetReportRouter = Router();
  assetRoutes(assetReportRouter);
  router.use(assetReportRouter);

  const locationReportRouter = Router();
  locationRoutes(locationReportRouter);
  router.use(locationReportRouter);
  return router;
};

export default createReportsRouter;
