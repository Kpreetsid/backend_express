import express from 'express';
import usersRouter from '../../modules/users/routes/user.routes';
import assetsRouter from '../../modules/assets/routes/asset.routes';
import equipmentRoutes from '../../modules/assets/routes/equipment.routes';
import companyRoutes from '../../modules/company/routes/company.routes';
import formCategoryRoutes from '../../modules/maintenance/routes/formCategory.routes';
import locationRoutes from '../../modules/locations/routes/location.routes';
import observationRoutes from '../../modules/assets/routes/observation.routes';
import partsRoutes from '../../modules/inventory/routes/parts.routes';
import postsRoutes from '../../modules/communications/routes/posts.routes';
import scheduleRoutes from '../../modules/maintenance/routes/schedule.routes';
import sopsRoutes from '../../modules/maintenance/routes/sops.routes';
import floorMapRoutes from '../../modules/locations/routes/floorMap.routes';
import troubleshootGuideRoutes from '../../modules/maintenance/routes/troubleshoot-guide.routes';
import partsTypeRoutes from '../../modules/inventory/routes/parts-type.routes';
import inspectionRoutes from '../../modules/maintenance/routes/inspection.routes';
import analysisFeatureRoutes from '../../modules/settings/routes/analysisFeature.routes';

const createFeatureRouter = (
    registerRoutes: (router: express.Router) => void
): express.Router => {
    const featureRouter = express.Router();
    registerRoutes(featureRouter);
    return featureRouter;
};

export default (): express.Router => {
    const router = express.Router();
    usersRouter(router);
    companyRoutes(router);
    router.use(createFeatureRouter(assetsRouter));
    router.use(createFeatureRouter(equipmentRoutes));
    router.use(createFeatureRouter(partsRoutes));
    router.use(createFeatureRouter(partsTypeRoutes));
    router.use(createFeatureRouter(postsRoutes));
    router.use(createFeatureRouter(scheduleRoutes));
    router.use(createFeatureRouter(inspectionRoutes));
    router.use(createFeatureRouter(sopsRoutes));
    router.use(createFeatureRouter(locationRoutes));
    router.use(createFeatureRouter(formCategoryRoutes));
    router.use(createFeatureRouter(observationRoutes));
    floorMapRoutes(router);
    troubleshootGuideRoutes(router);
    analysisFeatureRoutes(router);
    return router;
}

