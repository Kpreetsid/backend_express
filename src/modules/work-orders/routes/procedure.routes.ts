import express from 'express';
import { procedureController } from '../controllers/procedure.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { procedureValidator, updateProcedureValidator } from '../validators/procedure.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
  const procedureRouter = express.Router();
  procedureRouter.get('/', procedureController.getAll);
  procedureRouter.get('/:id', validateParamId, procedureController.getById);
  procedureRouter.post('/', procedureValidator, validate, procedureController.create);
  procedureRouter.put('/:id', validateParamId, updateProcedureValidator, validate, procedureController.update);
  procedureRouter.patch('/:id', validateParamId, updateProcedureValidator, validate, procedureController.update);
  procedureRouter.delete('/:id', validateParamId, procedureController.remove);
  router.use('/procedures', procedureRouter);
};

