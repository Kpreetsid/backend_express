import express from 'express';
import { getParts, getPart, createPart, updatePart, removePart, getFilterParts } from './parts.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const partRouter = express.Router();
    partRouter.get('/', getParts);
    partRouter.get('/filter', getFilterParts);
    partRouter.get('/:id', getPart);
    partRouter.post('/', createPart);
    partRouter.put('/:id', updatePart);
    partRouter.delete('/:id', hasPermission('admin'),removePart);
    router.use('/parts', partRouter);
}