import express from 'express';
import { instructionController } from './instruction.controller';

export default (router: express.Router) => {
    const instructionRouter = express.Router();
    instructionRouter.get('/', instructionController.getAll);
    instructionRouter.get('/:id', instructionController.getDataById);
    instructionRouter.post('/', instructionController.create);
    instructionRouter.put('/:id', instructionController.update);
    instructionRouter.patch('/:id', instructionController.update);
    instructionRouter.delete('/:id', instructionController.remove);
    router.use('/instructions', instructionRouter);
}