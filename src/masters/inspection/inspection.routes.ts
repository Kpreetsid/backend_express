import express from 'express';
import { inspectionController } from './inspection.controller';
import { validateParamId } from "../../middlewares/validate";
import { inspectionValidator } from './inspection.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (outer: express.Router) => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', inspectionController.getAll);
  inspectionRouter.get('/:id', validateParamId, inspectionController.getById);
  inspectionRouter.post('/', inspectionValidator, validate, inspectionController.create);
  inspectionRouter.put('/:id', validateParamId, inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.patch('/:id', validateParamId, inspectionValidator, validate, inspectionController.updateById);
  inspectionRouter.delete('/:id', validateParamId, inspectionController.removeById);
  outer.use('/inspections', inspectionRouter);
};
