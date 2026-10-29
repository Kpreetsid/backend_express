import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { analysisFeatureController } from '../controllers/analysisFeature.controller';

export default (router: express.Router) => {
    const analysisFeatureRouter = express.Router();
    analysisFeatureRouter.use(hasRolePermission('admin_panel', 'view'));
    analysisFeatureRouter.get('/', analysisFeatureController.getFeatureData);
    analysisFeatureRouter.put('/:id', hasRolePermission('admin_panel', 'edit'), analysisFeatureController.updateFeatureData);
    router.use('/analysis-features', analysisFeatureRouter);
}