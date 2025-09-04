import express from 'express';
import { getAll, getDataById, create, update, remove } from './instruction.controller';

export default (router: express.Router) => {
    const instructionRouter = express.Router();
    instructionRouter.get('/', getAll);
    instructionRouter.get('/:id', getDataById);
    instructionRouter.post('/', create);
    instructionRouter.put('/:id', update);
    instructionRouter.delete('/:id', remove);
    router.use('/instructions', instructionRouter);
}