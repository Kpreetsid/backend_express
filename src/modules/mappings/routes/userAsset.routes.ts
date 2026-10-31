import express from 'express';
import { hasAnyRolePermission, hasRolePermission } from '@common/middlewares/permission.middleware';
import { userAssetController } from '@modules/mappings/controllers/userAsset.controller';
import { validateParam } from '@common/middlewares/validate.middleware';
import { userAssetValidator, userAssetUpdateValidator } from '@modules/mappings/validators/userAsset.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.get('/userToAssets', hasAnyRolePermission([['users', 'view'], ['asset_mail', 'view']]), userAssetController.getUserAssets);
    router.post('/userToAssets', hasRolePermission('users', 'edit'), userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', validateParam("assetId"), hasRolePermission('users', 'edit'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', hasRolePermission('users', 'edit'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', hasRolePermission('asset_mail', 'edit'), userAssetController.updateSendMailFlag);
}