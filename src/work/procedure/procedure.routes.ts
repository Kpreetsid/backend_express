import express from 'express';
import { procedureController } from './procedure.controller';
import { validateParamId } from '../../middlewares/validate';
import { procedureValidator, updateProcedureValidator } from './procedure.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (router: express.Router) => {
  const procedureRouter = express.Router();
  procedureRouter.get('/', procedureController.getAll);
  procedureRouter.get('/:id', validateParamId, procedureController.getById);
  procedureRouter.post('/', hasAccountFeature('procedures', 'add'), procedureValidator, validate, procedureController.create);
  procedureRouter.put('/:id', hasAccountFeature('procedures', 'edit'), validateParamId, updateProcedureValidator, validate, procedureController.update);
  procedureRouter.patch('/:id', hasAccountFeature('procedures', 'edit'), validateParamId, updateProcedureValidator, validate, procedureController.update);
  procedureRouter.delete('/:id', hasAccountFeature('procedures', 'delete'), validateParamId, procedureController.remove);
  router.use('/procedures', procedureRouter);
};
