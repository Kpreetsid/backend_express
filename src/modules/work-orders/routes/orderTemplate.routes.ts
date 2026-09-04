import express from 'express';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { orderTemplateController } from '../controllers/orderTemplate.controller';
import { orderTemplateValidator, updateOrderTemplateValidator } from '../validators/orderTemplate.validator';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

export default (router: express.Router) => {
  const orderTemplateRouter = express.Router();

  orderTemplateRouter.get('/', orderTemplateController.getAll);
  orderTemplateRouter.get('/:id', validateParamId, orderTemplateController.getById);
  orderTemplateRouter.post('/', hasRolePermission('workOrder', 'create_work_order'), orderTemplateValidator, validate, orderTemplateController.create);
  orderTemplateRouter.put('/:id', validateParamId, hasRolePermission('workOrder', 'edit_work_order'), updateOrderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.patch('/:id', validateParamId, hasRolePermission('workOrder', 'edit_work_order'), updateOrderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.delete('/:id', validateParamId, hasRolePermission('workOrder', 'delete_work_order'), orderTemplateController.remove);

  router.use('/order-templates', orderTemplateRouter);
};

