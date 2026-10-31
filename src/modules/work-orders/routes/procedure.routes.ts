import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { procedureController } from '@modules/work-orders/controllers/procedure.controller';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { procedureValidator, updateProcedureValidator } from '@modules/work-orders/validators/procedure.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
  const procedureRouter = express.Router();
  procedureRouter.use(hasRolePermission('procedures', 'view'));
  procedureRouter.get('/', procedureController.getAll);
  procedureRouter.get('/:id', validateParamId, procedureController.getById);
  procedureRouter.post('/', hasRolePermission('procedures', 'add'), procedureValidator, validate, procedureController.create);
  procedureRouter.put('/:id', validateParamId, hasRolePermission('procedures', 'edit'), updateProcedureValidator, validate, procedureController.update);
  procedureRouter.patch('/:id', validateParamId, hasRolePermission('procedures', 'edit'), updateProcedureValidator, validate, procedureController.update);
  procedureRouter.delete('/:id', validateParamId, hasRolePermission('procedures', 'delete'), procedureController.remove);
  router.use('/procedures', procedureRouter);
};

