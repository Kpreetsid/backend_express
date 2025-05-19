import express from 'express';
import userWorkOrderRoutes from './mapUserWorkOrder/userWorkOrder.routes';
import userLocationRoutes from './mapUserLocation/userLocation.routes';
const router = express.Router();

export default (): express.Router => {
    userLocationRoutes(router);
    userWorkOrderRoutes(router);
    return router;
}