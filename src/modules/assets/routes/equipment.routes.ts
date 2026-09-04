import express from 'express';
import { equipmentController } from '../controllers/equipment.controller';
import { hasAnyRolePermission, hasRolePermission } from '../../../common/middlewares/index';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { equipmentValidator } from '../validators/equipment.validator';

export default (router: express.Router) => {
    const equipmentRouter = express.Router();
    equipmentRouter.get('/', equipmentController.getAssets);
    equipmentRouter.get('/tree', equipmentController.getAssetTree);
    equipmentRouter.get('/tree/:id', validateParamId, equipmentController.getAssetTreeById);
    equipmentRouter.get('/child/:id', validateParamId, equipmentController.getChildAsset);
    equipmentRouter.get('/make-copy/:id', validateParamId,
        hasAnyRolePermission('asset', ['add_asset', 'add_child_asset']), equipmentController.makeAssetCopy);
    equipmentRouter.post('/', hasRolePermission('asset', 'add_asset'), equipmentValidator, validate, equipmentController.create);
    equipmentRouter.get('/:id', validateParamId, equipmentController.getAsset);
    equipmentRouter.put('/:id', validateParamId, hasRolePermission('asset', 'edit_asset'),
        equipmentValidator, validate, equipmentController.update);
    equipmentRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), equipmentController.updateAssetImage);
    equipmentRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_asset'), equipmentController.removeAsset);
    router.use('/equipment', equipmentRouter);
}
