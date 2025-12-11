import express from 'express';
import { userWorkOrderController } from './userWorkOrder.controller';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/', userWorkOrderController.getUserWorkOrders);
    workOrderRouter.get('/:workOrderId', userWorkOrderController.getMappedData);
    router.use('/users/workOrders', workOrderRouter);
}