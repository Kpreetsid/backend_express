import express from 'express';
import { inspectionController } from './inspection.controller';
import { validateParamId } from "../../middlewares/validate";
import { inspectionValidator, updateInspectionValidator } from './inspection.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares/permission';

export default (outer: express.Router) => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', hasRolePermission('form', 'view'), inspectionController.getAll);
  inspectionRouter.get('/:id', validateParamId, hasRolePermission('form', 'view'), inspectionController.getById);
  inspectionRouter.post('/', hasRolePermission('form', 'add'), inspectionValidator, validate, inspectionController.create);
  inspectionRouter.put('/:id', validateParamId, hasRolePermission('form', 'edit'), inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.patch('/:id', validateParamId, hasRolePermission('form', 'edit'), updateInspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.delete('/:id', validateParamId, hasRolePermission('form', 'delete'), inspectionController.removeById);
  outer.use('/inspections', inspectionRouter);
};
