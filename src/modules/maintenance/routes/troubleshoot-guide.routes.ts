import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { troubleshootGuideController } from '../controllers/troubleshoot-guide.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { troubleshootGuideValidator } from '../validators/troubleshoot-guide.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const troubleshootGuideRouter = express.Router();
    troubleshootGuideRouter.use(hasRolePermission('procedures', 'view'));
    troubleshootGuideRouter.get('/', troubleshootGuideController.getAllData);
    troubleshootGuideRouter.get('/:id', validateParamId, troubleshootGuideController.getDataByID);
    troubleshootGuideRouter.post('/', hasRolePermission('procedures', 'add'), troubleshootGuideValidator, validate, troubleshootGuideController.createData);
    troubleshootGuideRouter.put('/:id', validateParamId, hasRolePermission('procedures', 'edit'), troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
    troubleshootGuideRouter.patch('/:id', validateParamId, hasRolePermission('procedures', 'edit'), troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
    troubleshootGuideRouter.delete('/:id', validateParamId, hasRolePermission('procedures', 'delete'), troubleshootGuideController.removeData);
    router.use('/troubleshoot-guides', troubleshootGuideRouter);
}