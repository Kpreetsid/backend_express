import express from 'express';
import userWorkOrderRoutes from './mapUserWorkOrder/userWorkOrder.routes';
import userLocationRoutes from './mapUserLocation/userLocation.routes';
import userAssetRoutes from './mapUserAsset/userAsset.routes';
const router = express.Router();

export default (): express.Router => {
    userAssetRoutes(router);
    userLocationRoutes(router);
    userWorkOrderRoutes(router);
    return router;
}