import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { userAssetController } from '../controllers/userAsset.controller';
import { validateParam } from '../../../common/middlewares/validate.middleware';
import { userAssetValidator, userAssetUpdateValidator } from '../validators/userAsset.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.get('/userToAssets', hasRolePermission('users', 'view'), userAssetController.getUserAssets);
    router.post('/userToAssets', hasRolePermission('users', 'edit'), userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', validateParam("assetId"), hasRolePermission('users', 'edit'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', hasRolePermission('users', 'edit'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', hasRolePermission('users', 'edit'), userAssetController.updateSendMailFlag);
}