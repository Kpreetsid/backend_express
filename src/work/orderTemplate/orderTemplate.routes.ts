import express from 'express';
import { validateParamId } from '../../middlewares/validate';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';
import { orderTemplateController } from './orderTemplate.controller';
import { orderTemplateValidator } from './orderTemplate.validator';

export default (router: express.Router) => {
  const orderTemplateRouter = express.Router();

  orderTemplateRouter.get('/', orderTemplateController.getAll);
  orderTemplateRouter.get('/:id', validateParamId, orderTemplateController.getById);
  orderTemplateRouter.post('/', hasAccountFeature('work_order_templates', 'add'), orderTemplateValidator, validate, orderTemplateController.create);
  orderTemplateRouter.put('/:id', hasAccountFeature('work_order_templates', 'edit'), validateParamId, orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.patch('/:id', hasAccountFeature('work_order_templates', 'edit'), validateParamId, orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.delete('/:id', hasAccountFeature('work_order_templates', 'delete'), validateParamId, orderTemplateController.remove);

  router.use('/order-templates', orderTemplateRouter);
};
