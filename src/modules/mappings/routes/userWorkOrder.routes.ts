import express from 'express';
import { userWorkOrderController } from '../controllers/userWorkOrder.controller';
import { validateParam } from '../../../common/middlewares/validate.middleware';
import { updateUserWorkOrderValidator, userWorkOrderValidator } from '../validators/userWorkOrder.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/', userWorkOrderController.getUserWorkOrders);
    workOrderRouter.get('/:workOrderId', validateParam("workOrderId"), userWorkOrderController.getMappedData);
    workOrderRouter.post('/', hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderValidator, validate, userWorkOrderController.create);
    workOrderRouter.put('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), updateUserWorkOrderValidator, validate, userWorkOrderController.update);
    workOrderRouter.patch('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), updateUserWorkOrderValidator, validate, userWorkOrderController.update);
    workOrderRouter.delete('/:workOrderId', validateParam("workOrderId"), hasRolePermission('workOrder', 'edit_work_order'), userWorkOrderController.remove);
    router.use('/users/workOrders', workOrderRouter);
}
