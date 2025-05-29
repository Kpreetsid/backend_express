import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getAssetTree, createAsset, updateAsset, removeAsset } from './asset.controller';
import { hasPermission } from '../../_config/permission';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/', getAssets);
    assetRouter.post('/tree', getAssetTree);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.get('/:id', getAsset);
    assetRouter.post('/', createAsset);
    assetRouter.put('/:id', updateAsset);
    assetRouter.delete('/:id', hasPermission('admin'),removeAsset);
    router.use('/assets', assetRouter);
}