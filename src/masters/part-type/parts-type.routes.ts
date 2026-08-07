import express from 'express';
import { partsTypeController } from './parts-type.controller';
import { validateParamId } from '../../middlewares/validate';
import { partTypeValidator } from './part-type.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const partTypeRouter = express.Router();
    partTypeRouter.get('/', partsTypeController.getPartsTypes);
    partTypeRouter.get('/:id', validateParamId, partsTypeController.getPartType);
    partTypeRouter.post('/', partTypeValidator, validate, partsTypeController.createPartType);
    partTypeRouter.put('/:id', validateParamId, partTypeValidator, validate, partsTypeController.updatePartType);
    partTypeRouter.patch('/:id', validateParamId, partTypeValidator, validate, partsTypeController.updatePartType);
    partTypeRouter.delete('/:id', validateParamId, partsTypeController.removePartType);
    router.use('/parts-types', partTypeRouter);
}