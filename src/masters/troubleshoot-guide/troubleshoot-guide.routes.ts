import express from 'express';
import { getAllData, getDataByID, createData, updateData, removeData } from './troubleshoot-guide.controller';

export default (router: express.Router) => {
    const troubleshootGuideRouter = express.Router();
    troubleshootGuideRouter.get('/', getAllData);
    troubleshootGuideRouter.get('/:id', getDataByID);
    troubleshootGuideRouter.post('/', createData);
    troubleshootGuideRouter.put('/:id', updateData);
    troubleshootGuideRouter.delete('/:id', removeData);
    router.use('/troubleshoot-guides', troubleshootGuideRouter);
}