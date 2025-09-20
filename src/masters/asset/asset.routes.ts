import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getAssetTree, removeAsset, create, createOld, updateOld, updateAssetImage, update, getAssetSensorList } from './asset.controller';
import { hasRolePermission, isOwnerOrAdmin } from '../../middlewares';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/', getAssets);
    assetRouter.get('/sensor-list', getAssetSensorList);
    assetRouter.get('/tree', getAssetTree);
    assetRouter.get('/tree/:id', getAssetTree);
    assetRouter.get('/:id', getAsset);
    assetRouter.post('/', hasRolePermission('asset', 'add_asset'), create);
    assetRouter.post('/old', hasRolePermission('asset', 'add_asset'), createOld);
    assetRouter.put('/old-edit/:id', hasRolePermission('asset', 'edit_asset'), updateOld);
    assetRouter.post('/tree', getAssetTree);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.put('/:id', hasRolePermission('asset', 'edit_asset'), isOwnerOrAdmin, update);
    assetRouter.patch('/:id', hasRolePermission('asset', 'edit_asset'), isOwnerOrAdmin, updateAssetImage);
    assetRouter.delete('/:id', hasRolePermission('asset', 'delete_asset'), removeAsset);
    router.use('/assets', assetRouter);
}