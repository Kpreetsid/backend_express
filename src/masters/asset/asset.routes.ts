import express from 'express';
import { assetController } from './asset.controller';
import { hasAccountFeature, hasRolePermission } from '../../middlewares';
import { validateParamId, validateParam } from '../../middlewares/validate';
import { assetValidator } from './asset.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const assetRouter = express.Router();
    assetRouter.get('/buzzer', assetController.getBuzzerAssetList);
    assetRouter.patch('/buzzer/:location_id', hasAccountFeature('asset', 'edit'), validateParam("location_id"), assetController.setBuzzerAssetList);
    assetRouter.get('/', assetController.getAssets);
    assetRouter.get('/sensor-list', assetController.getAssetSensorList);
    assetRouter.get('/tree', assetController.getAssetTree);
    assetRouter.get('/child/:id', validateParamId, assetController.getChildAsset);
    assetRouter.get('/make-copy/:id', hasAccountFeature('child_asset', 'add'), validateParamId, hasRolePermission('asset', 'add_asset'), assetController.makeAssetCopy);
    assetRouter.get('/:id', validateParamId, assetController.getAsset);
    assetRouter.post('/sensor-list', assetController.getFilteredAssetSensorList);
    assetRouter.post('/old', hasAccountFeature('asset', 'add'), hasRolePermission('asset', 'add_asset'), assetValidator, validate, assetController.createOld);
    assetRouter.put('/old-edit/:id', hasAccountFeature('asset', 'edit'), validateParamId, hasRolePermission('asset', 'edit_asset'), assetValidator, validate, assetController.updateOld);
    assetRouter.post('/filter', assetController.getFilteredAssets);
    assetRouter.patch('/:id', hasAccountFeature('asset', 'edit'), validateParamId, hasRolePermission('asset', 'edit_asset'), assetController.updateAssetImage);
    assetRouter.delete('/:id', hasAccountFeature('asset', 'delete'), validateParamId, hasRolePermission('asset', 'delete_asset'), assetController.removeAsset);
    router.use('/assets', assetRouter);
}
