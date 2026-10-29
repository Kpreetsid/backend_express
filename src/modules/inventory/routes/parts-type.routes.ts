import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { partsTypeController } from '../controllers/parts-type.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { partTypeValidator } from '../validators/part-type.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const partTypeRouter = express.Router();
    partTypeRouter.use(hasRolePermission('inventory', 'view'));
    partTypeRouter.get('/', partsTypeController.getPartsTypes);
    partTypeRouter.get('/:id', validateParamId, partsTypeController.getPartType);
    partTypeRouter.post('/', hasRolePermission('inventory', 'add'), partTypeValidator, validate, partsTypeController.createPartType);
    partTypeRouter.put('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partTypeValidator, validate, partsTypeController.updatePartType);
    partTypeRouter.patch('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partTypeValidator, validate, partsTypeController.updatePartType);
    partTypeRouter.delete('/:id', validateParamId, hasRolePermission('inventory', 'delete'), partsTypeController.removePartType);
    router.use('/parts-types', partTypeRouter);
}