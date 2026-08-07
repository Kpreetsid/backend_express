import express from 'express';
import { troubleshootGuideController } from './troubleshoot-guide.controller';
import { validateParamId } from '../../middlewares/validate';
import { troubleshootGuideValidator } from './troubleshoot-guide.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const troubleshootGuideRouter = express.Router();
    troubleshootGuideRouter.get('/', troubleshootGuideController.getAllData);
    troubleshootGuideRouter.get('/:id', validateParamId, troubleshootGuideController.getDataByID);
    troubleshootGuideRouter.post('/', troubleshootGuideValidator, validate, troubleshootGuideController.createData);
    troubleshootGuideRouter.put('/:id', validateParamId, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
    troubleshootGuideRouter.patch('/:id', validateParamId, troubleshootGuideValidator, validate, troubleshootGuideController.updateData);
    troubleshootGuideRouter.delete('/:id', validateParamId, troubleshootGuideController.removeData);
    router.use('/troubleshoot-guides', troubleshootGuideRouter);
}