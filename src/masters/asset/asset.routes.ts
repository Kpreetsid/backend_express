import express from 'express';
import { assetController } from './asset.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId, validateParam } from '../../middlewares/validate';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/buzzer', assetController.getBuzzerAssetList);
    assetRouter.patch('/buzzer/:location_id', validateParam("location_id"), assetController.setBuzzerAssetList);
    assetRouter.get('/', assetController.getAssets);
    assetRouter.get('/sensor-list', assetController.getAssetSensorList);
    assetRouter.get('/tree', assetController.getAssetTree);
    assetRouter.get('/child/:id', validateParamId, assetController.getChildAsset);
    assetRouter.get('/make-copy/:id', validateParamId, hasRolePermission('asset', 'add_asset'), assetController.makeAssetCopy);
    assetRouter.get('/:id', validateParamId, assetController.getAsset);
    assetRouter.post('/sensor-list', assetController.getFilteredAssetSensorList);
    assetRouter.post('/old', hasRolePermission('asset', 'add_asset'), assetController.createOld);
    assetRouter.put('/old-edit/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), assetController.updateOld);
    assetRouter.post('/filter', assetController.getFilteredAssets);
    assetRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), assetController.updateAssetImage);
    assetRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_asset'), assetController.removeAsset);
    router.use('/assets', assetRouter);
}