import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { troubleshootGuideController } from '../controllers/troubleshoot-guide.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { troubleshootGuideQueryValidator, troubleshootGuideValidator } from '../validators/troubleshoot-guide.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasGuideMutationPermission } from '../services/guide-scope.service';

export default (router: express.Router) => {
  const troubleshootGuideRouter = express.Router();
  troubleshootGuideRouter.use(hasRolePermission('procedures', 'view'));
  troubleshootGuideRouter.get('/', troubleshootGuideQueryValidator, validate, troubleshootGuideController.getAllData);
  troubleshootGuideRouter.get('/:id', validateParamId, troubleshootGuideController.getDataByID);
  troubleshootGuideRouter.post('/', hasRolePermission('procedures', 'add'), hasGuideMutationPermission, troubleshootGuideValidator, validate, troubleshootGuideController.createData);
  troubleshootGuideRouter.put('/:id', validateParamId, hasRolePermission('procedures', 'edit'), hasGuideMutationPermission, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
  troubleshootGuideRouter.patch('/:id', validateParamId, hasRolePermission('procedures', 'edit'), hasGuideMutationPermission, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
  troubleshootGuideRouter.delete('/:id', validateParamId, hasRolePermission('procedures', 'delete'), troubleshootGuideController.removeData);
  router.use('/troubleshoot-guides', troubleshootGuideRouter);
};
