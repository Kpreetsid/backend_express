import express from 'express';
const router = express.Router();
import usersRouter from './user/user.routes';
import assetsRouter from './asset/asset.routes';
import equipmentRoutes from './equipment/equipment.routes';
import companyRoutes from './company/company.routes';
import formCategoryRoutes from './formCategory/formCategory.routes';
import locationRoutes from './location/location.routes';
import observationRoutes from './observation/observation.routes';
import partsRoutes from './part/parts.routes';
import postsRoutes from './post/posts.routes';
import scheduleRoutes from './schedule/schedule.routes';
import sopsRoutes from './sops/sops.routes';
import floorMapRoutes from './floorMap/floorMap.routes';
import troubleshootGuideRoutes from './troubleshoot-guide/troubleshoot-guide.routes';
import partsTypeRoutes from './part-type/parts-type.routes';
import inspectionRoutes from './inspection/inspection.routes';
import { hasAccountFeature, hasAnyAccountFeature } from '../middlewares/permission';

const withAccountFeature = (
    menuKey: string,
    registerRoutes: (router: express.Router) => void
): express.Router => {
    const featureRouter = express.Router();
    featureRouter.use(hasAccountFeature(menuKey));
    registerRoutes(featureRouter);
    return featureRouter;
};

const withAnyAccountFeature = (
    menuKeys: string[],
    registerRoutes: (router: express.Router) => void
): express.Router => {
    const featureRouter = express.Router();
    featureRouter.use(hasAnyAccountFeature(menuKeys));
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
    router.use(withAnyAccountFeature(['floor_map', 'location_floor_map'], floorMapRoutes));
    router.use(withAnyAccountFeature(['asset', 'location'], troubleshootGuideRoutes));
    return router;
}
