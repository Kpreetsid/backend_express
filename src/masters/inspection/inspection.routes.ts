import express from 'express';
import { inspectionController } from './inspection.controller';
import { validateParamId } from "../../middlewares/validate";
import { inspectionValidator } from './inspection.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (outer: express.Router) => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', inspectionController.getAll);
  inspectionRouter.get('/:id', validateParamId, inspectionController.getById);
  inspectionRouter.post('/', hasAccountFeature('inspections', 'add'), inspectionValidator, validate, inspectionController.create);
  inspectionRouter.put('/:id', hasAccountFeature('inspections', 'edit'), validateParamId, inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.patch('/:id', hasAccountFeature('inspections', 'edit'), validateParamId, inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.delete('/:id', hasAccountFeature('inspections', 'delete'), validateParamId, inspectionController.removeById);
  outer.use('/inspections', inspectionRouter);
};
