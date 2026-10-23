import express from 'express';
import { inspectionController } from '../controllers/inspection.controller';
import { validateParamId } from "../../../common/middlewares/validate.middleware";
import { inspectionValidator } from '../validators/inspection.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

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
