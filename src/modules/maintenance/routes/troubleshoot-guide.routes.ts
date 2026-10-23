import express from 'express';
import { troubleshootGuideController } from '../controllers/troubleshoot-guide.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { troubleshootGuideValidator } from '../validators/troubleshoot-guide.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

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