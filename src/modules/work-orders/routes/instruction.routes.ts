import express from 'express';
import { instructionController } from '../controllers/instruction.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { instructionQueryValidator, instructionValidator } from '../validators/instruction.validator';
import { validate } from '../../../common/middlewares/validator.middleware';
import { hasGuideMutationPermission } from '../../../common/utils/guideScope';

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
