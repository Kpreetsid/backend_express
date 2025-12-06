import express from 'express';
import { partsController } from './parts.controller';

export default (router: express.Router) => {
    const partRouter = express.Router();
    partRouter.get('/', partsController.getParts);
    partRouter.get('/:id', partsController.getPart);
    partRouter.post('/', partsController.createPart);
    partRouter.put('/:id', partsController.updatePart);
    partRouter.patch('/:id', partsController.updateStock);
    partRouter.delete('/:id', partsController.removePart);
    router.use('/parts', partRouter);
}