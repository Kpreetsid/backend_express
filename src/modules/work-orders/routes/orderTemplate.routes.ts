import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { validate } from '@common/middlewares/validator.middleware';
import { orderTemplateController } from '@modules/work-orders/controllers/orderTemplate.controller';
import { orderTemplateValidator } from '@modules/work-orders/validators/orderTemplate.validator';

export default (router: express.Router) => {
  const orderTemplateRouter = express.Router();
  orderTemplateRouter.use(hasRolePermission('work_order_templates', 'view'));

  orderTemplateRouter.get('/', orderTemplateController.getAll);
  orderTemplateRouter.get('/:id', validateParamId, orderTemplateController.getById);
  orderTemplateRouter.post('/', hasRolePermission('work_order_templates', 'add'), orderTemplateValidator, validate, orderTemplateController.create);
  orderTemplateRouter.put('/:id', validateParamId, hasRolePermission('work_order_templates', 'edit'), orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.patch('/:id', validateParamId, hasRolePermission('work_order_templates', 'edit'), orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.delete('/:id', validateParamId, hasRolePermission('work_order_templates', 'delete'), orderTemplateController.remove);

  router.use('/order-templates', orderTemplateRouter);
};

