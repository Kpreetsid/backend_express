import express from 'express';
import { procedureController } from '../controllers/procedure.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { procedureValidator, updateProcedureValidator } from '../validators/procedure.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

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

