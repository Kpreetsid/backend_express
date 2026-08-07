import express from 'express';
import { inspectionController } from './inspection.controller';
import { validateParamId } from "../../middlewares/validate";
import { inspectionValidator } from './inspection.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (outer: express.Router) => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', inspectionController.getAll);
  inspectionRouter.get('/:id', validateParamId, inspectionController.getById);
  inspectionRouter.post('/', hasRolePermission('inspections', 'add'), inspectionValidator, validate, inspectionController.create);
  inspectionRouter.put('/:id', validateParamId, hasRolePermission('inspections', 'edit'), inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.patch('/:id', validateParamId, hasRolePermission('inspections', 'edit'), inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.delete('/:id', validateParamId, hasRolePermission('inspections', 'delete'), inspectionController.removeById);
  outer.use('/inspections', inspectionRouter);
};
