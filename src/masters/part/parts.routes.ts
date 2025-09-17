import express from 'express';
import { getParts, getPart, createPart, updatePart, removePart } from './parts.controller';

export default (router: express.Router) => {
    const partRouter = express.Router();
    partRouter.get('/', getParts);
    partRouter.get('/:id', getPart);
    partRouter.post('/', createPart);
    partRouter.put('/:id', updatePart);
    partRouter.delete('/:id', removePart);
    router.use('/parts', partRouter);
}