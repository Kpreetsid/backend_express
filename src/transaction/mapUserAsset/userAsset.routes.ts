import express from 'express';
import { userAssetController } from './userAsset.controller';
import { validateParam } from '../../middlewares/validate';
import { userAssetMailFlagValidator, userAssetValidator, userAssetUpdateValidator } from './userAsset.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares/permission';

export default (router: express.Router) => {
    router.get('/userToAssets', userAssetController.getUserAssets);
    router.post('/userToAssets', hasRolePermission('asset', 'edit_asset'), userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', hasRolePermission('asset', 'edit_asset'), validateParam("assetId"), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', hasRolePermission('asset', 'edit_asset'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', hasRolePermission('asset_mail', 'edit'), userAssetMailFlagValidator, validate, userAssetController.updateSendMailFlag);
}
