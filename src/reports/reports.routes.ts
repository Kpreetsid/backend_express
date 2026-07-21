import express from 'express';
import assetRoutes from './asset/asset.routes';
import locationRoutes from './location/location.routes';
import { rateLimiter } from '../middlewares/rateLimits';
import { hasAccountFeature } from '../middlewares/permission';
const router = express.Router();

export default (): express.Router => {
    router.use(rateLimiter.reportLimiter);
    const assetReportRouter = express.Router();
    assetReportRouter.use(hasAccountFeature('master_asset'));
    assetRoutes(assetReportRouter);
    router.use(assetReportRouter);

    const locationReportRouter = express.Router();
    locationReportRouter.use(hasAccountFeature('master_location'));
    locationRoutes(locationReportRouter);
    router.use(locationReportRouter);
    return router;
}
