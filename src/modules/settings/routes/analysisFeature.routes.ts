import express from 'express';
import { validateParamId, validate } from '@common/middlewares/validate.middleware';
import { analysisFeatureUpdateValidator } from '../validators/analysisFeature.validator';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { analysisFeatureController } from '@modules/settings/controllers/analysisFeature.controller';


export default (router: express.Router) => {
    const analysisFeatureRouter = express.Router();
    analysisFeatureRouter.use(hasRolePermission('admin_panel', 'view'));
    analysisFeatureRouter.get('/', analysisFeatureController.getFeatureData);
    analysisFeatureRouter.put('/:id', validateParamId, hasRolePermission('admin_panel', 'edit'), analysisFeatureUpdateValidator, validate, analysisFeatureController.updateFeatureData);
    router.use('/analysis-features', analysisFeatureRouter);
}
