import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { userWorkOrderController } from '@modules/mappings/controllers/userWorkOrder.controller';
import { validateParam } from '@common/middlewares/validate.middleware';
import { userWorkOrderValidator } from '@modules/mappings/validators/userWorkOrder.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.use(hasRolePermission('workOrder', 'view'));
    workOrderRouter.get('/', userWorkOrderController.getUserWorkOrders);
    workOrderRouter.get('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.getMappedData);
    workOrderRouter.post('/', hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.create);
    workOrderRouter.put('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.update);
    workOrderRouter.patch('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.update);
    workOrderRouter.delete('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderController.remove);
    router.use('/users/workOrders', workOrderRouter);
}