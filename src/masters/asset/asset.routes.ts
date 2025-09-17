import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getAssetTree, removeAsset, create, createOld, updateAssetImage, update, getAssetSensorList } from './asset.controller';
import { isOwnerOrAdmin } from '../../middlewares';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/', getAssets);
    assetRouter.get('/sensor-list', getAssetSensorList);
    assetRouter.get('/tree', getAssetTree);
    assetRouter.get('/tree/:id', getAssetTree);
    assetRouter.get('/:id', getAsset);
    assetRouter.post('/', create);
    assetRouter.post('/old', createOld);
    assetRouter.post('/tree', getAssetTree);
    assetRouter.post('/filter', getFilteredAssets);
    assetRouter.put('/:id', isOwnerOrAdmin, update);
    assetRouter.patch('/:id', isOwnerOrAdmin, updateAssetImage);
    assetRouter.delete('/:id', removeAsset);
    router.use('/assets', assetRouter);
}