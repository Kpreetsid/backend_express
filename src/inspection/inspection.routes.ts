import express from 'express';
import { inspectionController } from './inspection.controller';
import { validateId, validateBody } from "../middlewares/validate";
import { createInspectionSchema, updateInspectionSchema } from '../models/inspection.model';

export default () => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', inspectionController.getAll);
  inspectionRouter.get('/:id', validateId, inspectionController.getById);
  inspectionRouter.post('/', validateBody(createInspectionSchema), inspectionController.create);
  inspectionRouter.put('/:id', validateId, validateBody(updateInspectionSchema), inspectionController.updateById);
  inspectionRouter.delete('/:id', validateId, inspectionController.removeById);
  return inspectionRouter;
};
