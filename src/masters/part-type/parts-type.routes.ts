import express from 'express';
import { partsTypeController } from './parts-type.controller';
import { validateParamId } from '../../middlewares/validate';
import { partTypeValidator } from './part-type.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const partTypeRouter = express.Router();
    partTypeRouter.get('/', hasRolePermission('inventory', 'view'), partsTypeController.getPartsTypes);
    partTypeRouter.get('/:id', validateParamId, hasRolePermission('inventory', 'view'), partsTypeController.getPartType);
    partTypeRouter.post('/', hasRolePermission('inventory', 'add'), partTypeValidator, validate, partsTypeController.createPartType);
    partTypeRouter.put('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partTypeValidator, validate, partsTypeController.updatePartType);
    partTypeRouter.patch('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partTypeValidator, validate, partsTypeController.updatePartType);
    partTypeRouter.delete('/:id', validateParamId, hasRolePermission('inventory', 'delete'), partsTypeController.removePartType);
    router.use('/parts-types', partTypeRouter);
}
