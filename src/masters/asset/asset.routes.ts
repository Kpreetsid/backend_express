import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getAssetTree, createAsset, updateAsset, removeAsset } from './asset.controller';
import { hasPermission, isOwnerOrAdmin } from '../../middlewares';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/', getAssets);
    assetRouter.get('/:id', getAsset);
    assetRouter.get('/tree', getAssetTree);
    assetRouter.get('/tree/:id', getAssetTree);
    assetRouter.post('/tree', getAssetTree);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.post('/', createAsset);
    assetRouter.put('/:id', isOwnerOrAdmin, updateAsset);
    assetRouter.delete('/:id', hasPermission('admin'),removeAsset);
    router.use('/assets', assetRouter);
}