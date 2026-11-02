import express from 'express';
import userWorkOrderRoutes from './mapUserWorkOrder/userWorkOrder.routes';
import userLocationRoutes from './mapUserLocation/userLocation.routes';
import userAssetRoutes from './mapUserAsset/userAsset.routes';
import { userNotificationRoutes } from './userNotifications';
const router = express.Router();

export default (): express.Router => {
    userNotificationRoutes(router);
    const assetRouter = express.Router();
    userAssetRoutes(assetRouter);
    router.use(assetRouter);

    const locationRouter = express.Router();
    userLocationRoutes(locationRouter);
    router.use(locationRouter);

    const workOrderRouter = express.Router();
    userWorkOrderRoutes(workOrderRouter);
    router.use(workOrderRouter);
    return router;
}

