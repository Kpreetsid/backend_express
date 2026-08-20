import express from 'express';
import { equipmentController } from './equipment.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const equipmentRouter = express.Router();
    equipmentRouter.get('/', equipmentController.getAssets);
    equipmentRouter.get('/tree', equipmentController.getAssetTree);
    equipmentRouter.get('/tree/:id', validateParamId, equipmentController.getAssetTreeById);
    equipmentRouter.get('/child/:id', validateParamId, equipmentController.getChildAsset);
    equipmentRouter.get('/make-copy/:id', validateParamId, hasRolePermission('asset', 'add_asset'), equipmentController.makeAssetCopy);
    equipmentRouter.post('/', hasRolePermission('asset', 'add_asset'), equipmentController.create);
    equipmentRouter.get('/:id', validateParamId, equipmentController.getAsset);
    equipmentRouter.put('/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), equipmentController.update);
    equipmentRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), equipmentController.updateAssetImage);
    equipmentRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_asset'), equipmentController.removeAsset);
    router.use('/equipment', equipmentRouter);
}
