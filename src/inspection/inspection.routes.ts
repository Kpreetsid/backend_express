import express from 'express';
import { inspectionController } from './inspection.controller';
import { validateParamId } from "../middlewares/validate";

export default () => {
  const inspectionRouter = express.Router();
  inspectionRouter.get('/', inspectionController.getAll);
  inspectionRouter.get('/:id', validateParamId, inspectionController.getById);
  inspectionRouter.post('/', inspectionController.create);
  inspectionRouter.put('/:id', validateParamId, inspectionController.updateById);
  inspectionRouter.patch('/:id', validateParamId, inspectionController.updateById);
  inspectionRouter.delete('/:id', validateParamId, validateParamId, inspectionController.removeById);
  return inspectionRouter;
};
