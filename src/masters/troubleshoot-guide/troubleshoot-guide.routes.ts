import express from 'express';
import { troubleshootGuideController } from './troubleshoot-guide.controller';
import { validateParamId } from '../../middlewares/validate';
import { troubleshootGuideQueryValidator, troubleshootGuideValidator } from './troubleshoot-guide.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasGuideMutationPermission } from '../../utils/guideScope';

export default (router: express.Router) => {
  const troubleshootGuideRouter = express.Router();
  troubleshootGuideRouter.get('/', troubleshootGuideQueryValidator, validate, troubleshootGuideController.getAllData);
  troubleshootGuideRouter.get('/:id', validateParamId, troubleshootGuideController.getDataByID);
  troubleshootGuideRouter.post('/', hasGuideMutationPermission, troubleshootGuideValidator, validate, troubleshootGuideController.createData);
  troubleshootGuideRouter.put('/:id', validateParamId, hasGuideMutationPermission, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
  troubleshootGuideRouter.patch('/:id', validateParamId, hasGuideMutationPermission, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
  troubleshootGuideRouter.delete('/:id', validateParamId, troubleshootGuideController.removeData);
  router.use('/troubleshoot-guides', troubleshootGuideRouter);
};
