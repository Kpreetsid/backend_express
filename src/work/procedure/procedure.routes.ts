import express from 'express';
import { procedureController } from './procedure.controller';
import { validateParamId } from '../../middlewares/validate';
import { procedureValidator, updateProcedureValidator } from './procedure.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares/permission';

export default (router: express.Router) => {
  const procedureRouter = express.Router();
  procedureRouter.get('/', procedureController.getAll);
  procedureRouter.get('/:id', validateParamId, procedureController.getById);
  procedureRouter.post('/', hasRolePermission('workOrder', 'create_work_order'), procedureValidator, validate, procedureController.create);
  procedureRouter.put('/:id', validateParamId, hasRolePermission('workOrder', 'edit_work_order'), updateProcedureValidator, validate, procedureController.update);
  procedureRouter.patch('/:id', validateParamId, hasRolePermission('workOrder', 'edit_work_order'), updateProcedureValidator, validate, procedureController.update);
  procedureRouter.delete('/:id', validateParamId, hasRolePermission('workOrder', 'delete_work_order'), procedureController.remove);
  router.use('/procedures', procedureRouter);
};

