import express from 'express';
import { troubleshootGuideController } from './troubleshoot-guide.controller';
import { validateParamId } from '../../middlewares/validate';
import { troubleshootGuideValidator } from './troubleshoot-guide.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAnyRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const troubleshootGuideRouter = express.Router();
    troubleshootGuideRouter.get('/', troubleshootGuideController.getAllData);
    troubleshootGuideRouter.get('/:id', validateParamId, troubleshootGuideController.getDataByID);
    const canManageKnowledge = hasAnyRolePermission(
        { moduleName: 'asset', action: 'edit_asset' },
        { moduleName: 'location', action: 'edit_location' }
    );
    troubleshootGuideRouter.post('/', canManageKnowledge, troubleshootGuideValidator, validate, troubleshootGuideController.createData);
    troubleshootGuideRouter.put('/:id', validateParamId, canManageKnowledge, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
    troubleshootGuideRouter.patch('/:id', validateParamId, canManageKnowledge, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
    troubleshootGuideRouter.delete('/:id', validateParamId, canManageKnowledge, troubleshootGuideController.removeData);
    router.use('/troubleshoot-guides', troubleshootGuideRouter);
}
