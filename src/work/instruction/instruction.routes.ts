import express from 'express';
import { instructionController } from './instruction.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const instructionRouter = express.Router();
    instructionRouter.get('/', instructionController.getAll);
    instructionRouter.get('/:id', validateParamId, instructionController.getDataById);
    instructionRouter.post('/', instructionController.create);
    instructionRouter.put('/:id', validateParamId, instructionController.update);
    instructionRouter.patch('/:id', validateParamId, instructionController.update);
    instructionRouter.delete('/:id', validateParamId, instructionController.remove);
    router.use('/instructions', instructionRouter);
}