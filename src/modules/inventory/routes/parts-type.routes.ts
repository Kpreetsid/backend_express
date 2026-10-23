import express from 'express';
import { partsTypeController } from '../controllers/parts-type.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { partTypeValidator } from '../validators/part-type.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

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