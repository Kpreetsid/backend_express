import express from 'express';
import { inspectionController } from '../controllers/inspection.controller';
import { validateParamId } from "../../../common/middlewares/validate.middleware";
import { inspectionValidator, updateInspectionValidator } from '../validators/inspection.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

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
