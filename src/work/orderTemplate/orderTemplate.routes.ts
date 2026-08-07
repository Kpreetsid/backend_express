import express from 'express';
import { validateParamId } from '../../middlewares/validate';
import { validate } from '../../middlewares/validator.middleware';
import { orderTemplateController } from './orderTemplate.controller';
import { orderTemplateValidator } from './orderTemplate.validator';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
  const orderTemplateRouter = express.Router();

  orderTemplateRouter.get('/', orderTemplateController.getAll);
  orderTemplateRouter.get('/:id', validateParamId, orderTemplateController.getById);
  orderTemplateRouter.post('/', hasRolePermission('workOrder', 'create_work_order'), orderTemplateValidator, validate, orderTemplateController.create);
  orderTemplateRouter.put('/:id', validateParamId, hasRolePermission('workOrder', 'edit_work_order'), orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.patch('/:id', validateParamId, hasRolePermission('workOrder', 'edit_work_order'), orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.delete('/:id', validateParamId, hasRolePermission('workOrder', 'delete_work_order'), orderTemplateController.remove);

  router.use('/order-templates', orderTemplateRouter);
};
