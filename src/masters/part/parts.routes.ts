import express from 'express';
import { partsController } from './parts.controller';
import { validateParamId } from '../../middlewares/validate';
import { partValidator } from './part.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const partRouter = express.Router();
    partRouter.get('/', partsController.getParts);
    partRouter.get('/cycle-counts', partsController.getCycleCounts);
    partRouter.get('/replenishment-suggestions', partsController.getReplenishmentSuggestions);
    partRouter.get('/:id', validateParamId, partsController.getPart);
    partRouter.post('/cycle-counts', partsController.createCycleCount);
    partRouter.put('/cycle-counts/:id/approve', validateParamId, partsController.approveCycleCount);
    partRouter.post('/', partValidator, validate, partsController.createPart);
    partRouter.put('/:id', validateParamId, partValidator, validate, partsController.updatePart);
    partRouter.patch('/:id', validateParamId, partsController.updateStock);
    partRouter.delete('/:id', validateParamId, partsController.removePart);
    router.use('/parts', partRouter);
}
