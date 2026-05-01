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

export default (): express.Router => {
    usersRouter(router);
    companyRoutes(router);
    assetsRouter(router);
    equipmentRoutes(router);
    partsRoutes(router);
    partsTypeRoutes(router);
    postsRoutes(router);
    scheduleRoutes(router);
    inspectionRoutes(router);
    sopsRoutes(router);
    locationRoutes(router);
    formCategoryRoutes(router);
    observationRoutes(router);
    floorMapRoutes(router);
    troubleshootGuideRoutes(router);
    return router;
}