import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getFilterByParam, getAssetTree, createAsset, updateAsset, removeAsset } from './asset.controller';
import { hasPermission, isOwnerOrAdmin } from '../../_config/permission';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/', getAssets);
    assetRouter.get('/filter', getFilterByParam);
    assetRouter.get('/:id', getAsset);
    assetRouter.post('/tree', getAssetTree);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.post('/', createAsset);
    assetRouter.put('/:id', isOwnerOrAdmin, updateAsset);
    assetRouter.delete('/:id', hasPermission('admin'),removeAsset);
    router.use('/assets', assetRouter);
}