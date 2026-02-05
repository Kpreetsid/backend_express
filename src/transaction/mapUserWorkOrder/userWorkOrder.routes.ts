import express from 'express';
import { userWorkOrderController } from './userWorkOrder.controller';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/', userWorkOrderController.getUserWorkOrders);
    workOrderRouter.get('/:workOrderId', userWorkOrderController.getMappedData);
    workOrderRouter.post('/', userWorkOrderController.create);
    workOrderRouter.put('/:workOrderId', userWorkOrderController.update);
    workOrderRouter.patch('/:workOrderId', userWorkOrderController.update);
    workOrderRouter.delete('/:workOrderId', userWorkOrderController.remove);
    router.use('/users/workOrders', workOrderRouter);
}