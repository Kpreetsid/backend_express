import express from 'express';
import { userWorkOrderController } from './userWorkOrder.controller';
import { validateParam } from '../../middlewares/validate';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/', userWorkOrderController.getUserWorkOrders);
    workOrderRouter.get('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.getMappedData);
    workOrderRouter.post('/', userWorkOrderController.create);
    workOrderRouter.put('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.update);
    workOrderRouter.patch('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.update);
    workOrderRouter.delete('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.remove);
    router.use('/users/workOrders', workOrderRouter);
}