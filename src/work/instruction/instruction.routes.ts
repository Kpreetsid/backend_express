import express from 'express';
import { instructionController } from './instruction.controller';
import { validateParamId } from '../../middlewares/validate';
import { instructionQueryValidator, instructionValidator } from './instruction.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasGuideMutationPermission } from '../../utils/guideScope';

export default (router: express.Router) => {
  const instructionRouter = express.Router();
  instructionRouter.get('/', instructionQueryValidator, validate, instructionController.getAll);
  instructionRouter.get('/:id', validateParamId, instructionController.getDataById);
  instructionRouter.post('/', hasGuideMutationPermission, instructionValidator, validate, instructionController.create);
  instructionRouter.put('/:id', validateParamId, hasGuideMutationPermission, instructionValidator, validate, instructionController.update);
  instructionRouter.patch('/:id', validateParamId, hasGuideMutationPermission, instructionValidator, validate, instructionController.update);
  instructionRouter.delete('/:id', validateParamId, instructionController.remove);
  router.use('/instructions', instructionRouter);
};
