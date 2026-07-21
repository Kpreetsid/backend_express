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
    router.use(withAccountFeature('master_asset', assetsRouter));
    router.use(withAccountFeature('master_asset', equipmentRoutes));
    router.use(withAccountFeature('master_inventory', partsRoutes));
    router.use(withAccountFeature('master_inventory', partsTypeRoutes));
    router.use(withAccountFeature('master_posts', postsRoutes));
    router.use(withAccountFeature('master_preventive', scheduleRoutes));
    router.use(withAccountFeature('master_inspections', inspectionRoutes));
    router.use(withAccountFeature('master_form', sopsRoutes));
    router.use(withAccountFeature('master_location', locationRoutes));
    router.use(withAccountFeature('master_form', formCategoryRoutes));
    router.use(withAccountFeature('master_asset', observationRoutes));
    router.use(withAnyAccountFeature(['master_dashboard', 'master_location'], floorMapRoutes));
    router.use(withAccountFeature('master_asset', troubleshootGuideRoutes));
    return router;
}
