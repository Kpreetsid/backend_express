import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getAssetTree, createAsset, updateAsset, removeAsset } from './asset.controller';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/', getAssets);
    assetRouter.post('/tree', getAssetTree);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.get('/:id', getAsset);
    assetRouter.post('/', createAsset);
    assetRouter.put('/:id', updateAsset);
    assetRouter.delete('/:id', removeAsset);
    router.use('/assets', assetRouter);
}