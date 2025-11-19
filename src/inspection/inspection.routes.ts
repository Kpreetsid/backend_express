import express from 'express';
import { getAll, create, getById, updateById, removeById } from './inspection.controller';
import { validateId, validateBody } from "../middlewares/validate";
import { createInspectionSchema, updateInspectionSchema } from '../models/inspection.model';

export default () => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', getAll);
  inspectionRouter.get('/:id', validateId, getById);
  inspectionRouter.post('/', validateBody(createInspectionSchema), create);
  inspectionRouter.put('/:id', validateId, validateBody(updateInspectionSchema), updateById);
  inspectionRouter.delete('/:id', validateId, removeById);
  return inspectionRouter;
};
