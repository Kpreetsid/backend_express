import express from 'express';
const router = express.Router();
import usersRouter from './user/user.routes';
import assetsRouter from './asset/asset.routes';
import companyRoutes from './company/company.routes';
import formCategoryRoutes from './formCategory/formCategory.routes';
import locationRoutes from './location/location.routes';
import observationRoutes from './observation/observation.routes';
import partsRoutes from './part/parts.routes';
import postsRoutes from './post/posts.routes';
import scheduleRoutes from './schedule/schedule.routes';
import sopsRoutes from './sops/sops.routes';
import teamRoutes from './team/team.routes';
import floorMapRoutes from './floorMap/floorMap.routes';
import featuresRoutes from './feature/features.routes';

export default (): express.Router => {
    usersRouter(router);
    companyRoutes(router);
    assetsRouter(router);
    partsRoutes(router);
    postsRoutes(router);
    scheduleRoutes(router);
    sopsRoutes(router);
    locationRoutes(router);
    formCategoryRoutes(router);
    observationRoutes(router);
    teamRoutes(router);
    floorMapRoutes(router);
    featuresRoutes(router);
    return router;
}