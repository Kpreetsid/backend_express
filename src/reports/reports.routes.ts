import express from 'express';
import assetRoutes from './asset/asset.routes';
import locationRoutes from './location/location.routes';
import { rateLimiter } from '../middlewares/rateLimits';
const router = express.Router();

export default (): express.Router => {
    router.use(rateLimiter.reportLimiter);
    const assetReportRouter = express.Router();
    assetRoutes(assetReportRouter);
    router.use(assetReportRouter);

    const locationReportRouter = express.Router();
    locationRoutes(locationReportRouter);
    router.use(locationReportRouter);
    return router;
}

