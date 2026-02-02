import express from 'express';
import { troubleshootGuideController } from './troubleshoot-guide.controller';

export default (router: express.Router) => {
    const troubleshootGuideRouter = express.Router();
    troubleshootGuideRouter.get('/', troubleshootGuideController.getAllData);
    troubleshootGuideRouter.get('/:id', troubleshootGuideController.getDataByID);
    troubleshootGuideRouter.post('/', troubleshootGuideController.createData);
    troubleshootGuideRouter.put('/:id', troubleshootGuideController.updateData);
    troubleshootGuideRouter.patch('/:id', troubleshootGuideController.updateData);
    troubleshootGuideRouter.delete('/:id', troubleshootGuideController.removeData);
    router.use('/troubleshoot-guides', troubleshootGuideRouter);
}