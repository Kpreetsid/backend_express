import express from 'express';
import assetRoutes from './asset/asset.routes';
import locationRoutes from './location/location.routes';
import { rateLimiter } from '../middlewares/rateLimits';
const router = express.Router();

export default (): express.Router => {
    router.use(rateLimiter.reportLimiter);
    assetRoutes(router);
    locationRoutes(router);
    return router;
}