import express from 'express';
import { assetController } from '../controllers/asset.controller';
import { hasRolePermission } from '../../../common/middlewares/index';
import { validateParamId, validateParam } from '../../../common/middlewares/validate.middleware';
import { assetTrainValidator, assetValidator } from '../validators/asset.validator';
import { validate } from '../../../common/middlewares/validator.middleware';
import { ASSET_TRAIN_CATALOG } from '../catalog/asset-train-catalog';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.use(hasRolePermission('asset', 'view'));
    assetRouter.get('/catalog', (_req, res) => {
        res.status(200).json({ status: true, data: ASSET_TRAIN_CATALOG });
    });
    assetRouter.get('/buzzer', assetController.getBuzzerAssetList);
    assetRouter.patch('/buzzer/:location_id', validateParam("location_id"), hasRolePermission('asset', 'edit_asset'), assetController.setBuzzerAssetList);
    assetRouter.get('/', assetController.getAssets);
    assetRouter.get('/sensor-list', assetController.getAssetSensorList);
    assetRouter.get('/tree', assetController.getAssetTree);
    assetRouter.get('/child/:id', validateParamId, assetController.getChildAsset);
    assetRouter.get('/make-copy/:id', validateParamId, hasRolePermission('asset', 'add_asset'), assetController.makeAssetCopy);
    assetRouter.get('/:id', validateParamId, assetController.getAsset);
    assetRouter.post('/sensor-list', assetController.getFilteredAssetSensorList);
    assetRouter.post('/old', hasRolePermission('asset', 'add_asset'), assetValidator, validate, assetController.createOld);
    assetRouter.post('/train', hasRolePermission('asset', 'add_asset'), assetTrainValidator, validate, assetController.createTrain);
    assetRouter.post('/:id/components', validateParamId, hasRolePermission('asset', 'add_child_asset'), assetController.createComponent);
    assetRouter.delete('/:id/components/:componentId', validateParamId, validateParam('componentId'),
        hasRolePermission('asset', 'delete_asset'), assetController.removeComponent);
    assetRouter.put('/old-edit/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), assetValidator, validate, assetController.updateOld);
    assetRouter.post('/filter', assetController.getFilteredAssets);
    assetRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_asset'), assetController.updateAssetImage);
    assetRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_asset'), assetController.removeAsset);
    router.use('/assets', assetRouter);
}
