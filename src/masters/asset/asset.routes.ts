import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getChildAsset, getAssetTree, removeAsset, createOld, updateOld, updateAssetImage, getAssetSensorList, makeAssetCopy, getBuzzerAssetList, setBuzzerAssetList } from './asset.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/buzzer', getBuzzerAssetList);
    assetRouter.patch('/buzzer/:location_id', setBuzzerAssetList);
    assetRouter.get('/', getAssets);
    assetRouter.get('/sensor-list', getAssetSensorList);
    assetRouter.get('/tree', getAssetTree);
    assetRouter.get('/child/:id', getChildAsset);
    assetRouter.get('/make-copy/:id', hasRolePermission('asset', 'add_asset'), makeAssetCopy);
    assetRouter.get('/:id', getAsset);
    assetRouter.post('/old', hasRolePermission('asset', 'add_asset'), createOld);
    assetRouter.put('/old-edit/:id', hasRolePermission('asset', 'edit_asset'), updateOld);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.patch('/:id', hasRolePermission('asset', 'edit_asset'), updateAssetImage);
    assetRouter.delete('/:id', hasRolePermission('asset', 'delete_asset'), removeAsset);
    router.use('/assets', assetRouter);
}