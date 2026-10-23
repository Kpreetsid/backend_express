import express from 'express';
const router = express.Router();
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

const withAccountFeature = (
    _menuKey: string,
    registerRoutes: (router: express.Router) => void
): express.Router => {
    const featureRouter = express.Router();
    registerRoutes(featureRouter);
    return featureRouter;
};

export default (): express.Router => {
    usersRouter(router);
    companyRoutes(router);
    router.use(withAccountFeature('asset', assetsRouter));
    router.use(withAccountFeature('asset', equipmentRoutes));
    router.use(withAccountFeature('inventory', partsRoutes));
    router.use(withAccountFeature('inventory', partsTypeRoutes));
    router.use(withAccountFeature('posts', postsRoutes));
    router.use(withAccountFeature('preventive', scheduleRoutes));
    router.use(withAccountFeature('inspections', inspectionRoutes));
    router.use(withAccountFeature('form', sopsRoutes));
    router.use(withAccountFeature('location', locationRoutes));
    router.use(withAccountFeature('form_category', formCategoryRoutes));
    router.use(withAccountFeature('observation', observationRoutes));
    floorMapRoutes(router);
    troubleshootGuideRoutes(router);
    analysisFeatureRoutes(router);
    return router;
}

