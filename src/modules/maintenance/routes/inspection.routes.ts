import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { inspectionController } from '../controllers/inspection.controller';
import { validateParamId } from "../../../common/middlewares/validate.middleware";
import { inspectionCorrectiveWorkOrderValidator, inspectionValidator } from '../validators/inspection.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (outer: express.Router) => {
  const inspectionRouter = express.Router();
  inspectionRouter.use(hasRolePermission('inspections', 'view'));
  inspectionRouter.get('/', inspectionController.getAll);
  inspectionRouter.get('/:id', validateParamId, inspectionController.getById);
  inspectionRouter.post('/', hasRolePermission('inspections', 'add'), inspectionValidator, validate, inspectionController.create);
  inspectionRouter.post('/:id/corrective-work-orders', validateParamId, hasRolePermission('inspections', 'edit'), hasRolePermission('workOrder', 'create_work_order'), inspectionCorrectiveWorkOrderValidator, validate, inspectionController.createCorrectiveWorkOrder);
  inspectionRouter.put('/:id', validateParamId, hasRolePermission('inspections', 'edit'), inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.patch('/:id', validateParamId, hasRolePermission('inspections', 'edit'), inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.delete('/:id', validateParamId, hasRolePermission('inspections', 'delete'), inspectionController.removeById);
  outer.use('/inspections', inspectionRouter);
};
