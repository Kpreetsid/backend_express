import express from 'express';
import { partsController } from './parts.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const partRouter = express.Router();
    partRouter.get('/', partsController.getParts);
    partRouter.get('/:id', validateParamId, partsController.getPart);
    partRouter.post('/', partsController.createPart);
    partRouter.put('/:id', validateParamId, partsController.updatePart);
    partRouter.patch('/:id', validateParamId, partsController.updateStock);
    partRouter.delete('/:id', validateParamId, partsController.removePart);
    router.use('/parts', partRouter);
}