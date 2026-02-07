import express from 'express';
import { troubleshootGuideController } from './troubleshoot-guide.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const troubleshootGuideRouter = express.Router();
    troubleshootGuideRouter.get('/', troubleshootGuideController.getAllData);
    troubleshootGuideRouter.get('/:id', validateParamId, troubleshootGuideController.getDataByID);
    troubleshootGuideRouter.post('/', troubleshootGuideController.createData);
    troubleshootGuideRouter.put('/:id', validateParamId, troubleshootGuideController.updateData);
    troubleshootGuideRouter.patch('/:id', validateParamId, troubleshootGuideController.updateData);
    troubleshootGuideRouter.delete('/:id', validateParamId, troubleshootGuideController.removeData);
    router.use('/troubleshoot-guides', troubleshootGuideRouter);
}