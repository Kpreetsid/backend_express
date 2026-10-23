import express from 'express';
import { instructionController } from '../controllers/instruction.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { instructionValidator } from '../validators/instruction.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const instructionRouter = express.Router();
    instructionRouter.get('/', instructionController.getAll);
    instructionRouter.get('/:id', validateParamId, instructionController.getDataById);
    instructionRouter.post('/', instructionValidator, validate, instructionController.create);
    instructionRouter.put('/:id', validateParamId, instructionValidator, validate, instructionController.update);
    instructionRouter.patch('/:id', validateParamId, instructionValidator, validate, instructionController.update);
    instructionRouter.delete('/:id', validateParamId, instructionController.remove);
    router.use('/instructions', instructionRouter);
}