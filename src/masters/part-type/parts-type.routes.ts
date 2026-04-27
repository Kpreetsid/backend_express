import express from 'express';
import { partsTypeController } from './parts-type.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const partTypeRouter = express.Router();
    partTypeRouter.get('/', partsTypeController.getPartsTypes);
    partTypeRouter.get('/:id', validateParamId, partsTypeController.getPartType);
    partTypeRouter.post('/', partsTypeController.createPartType);
    partTypeRouter.put('/:id', validateParamId, partsTypeController.updatePartType);
    partTypeRouter.patch('/:id', validateParamId, partsTypeController.updatePartType);
    partTypeRouter.delete('/:id', validateParamId, partsTypeController.removePartType);
    router.use('/parts-types', partTypeRouter);
}