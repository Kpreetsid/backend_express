import { Router } from 'express';
import userAssetRoutes from './userAsset.routes';
import userLocationRoutes from './userLocation.routes';
import userWorkOrderRoutes from './userWorkOrder.routes';

export const createMappingsRouter = (): Router => {
  const router = Router();
  const assetRouter = Router();
  userAssetRoutes(assetRouter);
  router.use(assetRouter);

  const locationRouter = Router();
  userLocationRoutes(locationRouter);
  router.use(locationRouter);

  const workOrderRouter = Router();
  userWorkOrderRoutes(workOrderRouter);
  router.use(workOrderRouter);
  return router;
};

export default createMappingsRouter;
