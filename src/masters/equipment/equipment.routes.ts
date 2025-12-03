import express from 'express';
import { getAssets, getAsset, getChildAsset, getAssetTree, removeAsset, create, updateAssetImage, update, makeAssetCopy } from './equipment.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const equipmentRouter = express.Router();
    equipmentRouter.get('/', getAssets);
    equipmentRouter.get('/tree', getAssetTree);
    equipmentRouter.get('/child/:id', getChildAsset);
    equipmentRouter.get('/make-copy/:id', hasRolePermission('asset', 'add_asset'), makeAssetCopy);
    equipmentRouter.get('/:id', getAsset);
    equipmentRouter.post('/', hasRolePermission('asset', 'add_asset'), create);
    equipmentRouter.put('/:id', hasRolePermission('asset', 'edit_asset'), update);
    equipmentRouter.patch('/:id', hasRolePermission('asset', 'edit_asset'), updateAssetImage);
    equipmentRouter.delete('/:id', hasRolePermission('asset', 'delete_asset'), removeAsset);
    router.use('/equipment', equipmentRouter);
}