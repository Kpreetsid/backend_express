import express from 'express';
import { userWorkOrderController } from './userWorkOrder.controller';
import { validateParam } from '../../middlewares/validate';
import { userWorkOrderValidator } from './userWorkOrder.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/', userWorkOrderController.getUserWorkOrders);
    workOrderRouter.get('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.getMappedData);
    workOrderRouter.post('/', hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.create);
    workOrderRouter.put('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.update);
    workOrderRouter.patch('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.update);
    workOrderRouter.delete('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderController.remove);
    router.use('/users/workOrders', workOrderRouter);
}
