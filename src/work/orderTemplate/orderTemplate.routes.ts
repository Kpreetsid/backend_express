import express from 'express';
import { validateParamId } from '../../middlewares/validate';
import { validate } from '../../middlewares/validator.middleware';
import { orderTemplateController } from './orderTemplate.controller';
import { orderTemplateValidator } from './orderTemplate.validator';

export default (router: express.Router) => {
  const orderTemplateRouter = express.Router();

  orderTemplateRouter.get('/', orderTemplateController.getAll);
  orderTemplateRouter.get('/:id', validateParamId, orderTemplateController.getById);
  orderTemplateRouter.post('/', orderTemplateValidator, validate, orderTemplateController.create);
  orderTemplateRouter.put('/:id', validateParamId, orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.patch('/:id', validateParamId, orderTemplateValidator, validate, orderTemplateController.update);
  orderTemplateRouter.delete('/:id', validateParamId, orderTemplateController.remove);

  router.use('/order-templates', orderTemplateRouter);
};

