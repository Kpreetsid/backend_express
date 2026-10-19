import { hasRolePermission } from '../../middlewares/permission';
import express from 'express';
import { userAssetController } from './userAsset.controller';
import { validateParam } from '../../middlewares/validate';
import { userAssetValidator, userAssetUpdateValidator } from './userAsset.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    router.get('/userToAssets', userAssetController.getUserAssets);
    router.post('/userToAssets', hasRolePermission('asset', 'edit_asset'), userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', hasRolePermission('asset', 'edit_asset'), validateParam("assetId"), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', hasRolePermission('asset', 'edit_asset'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', userAssetController.updateSendMailFlag);
}
