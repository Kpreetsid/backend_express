import express from 'express';
import userWorkOrderRoutes from './mapUserWorkOrder/userWorkOrder.routes';
import userLocationRoutes from './mapUserLocation/userLocation.routes';
import userAssetRoutes from './mapUserAsset/userAsset.routes';
import { hasAccountFeature } from '../middlewares/permission';
const router = express.Router();

export default (): express.Router => {
    const assetRouter = express.Router();
    assetRouter.use(hasAccountFeature('asset'));
    userAssetRoutes(assetRouter);
    router.use(assetRouter);

    const locationRouter = express.Router();
    locationRouter.use(hasAccountFeature('location'));
    userLocationRoutes(locationRouter);
    router.use(locationRouter);

    const workOrderRouter = express.Router();
    workOrderRouter.use(hasAccountFeature('work_order'));
    userWorkOrderRoutes(workOrderRouter);
    router.use(workOrderRouter);
    return router;
}
