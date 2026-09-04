import express from 'express';
import { userAssetController } from '../controllers/userAsset.controller';
import { validateParam } from '../../../common/middlewares/validate.middleware';
import { userAssetMailFlagsValidator, userAssetValidator, userAssetUpdateValidator } from '../validators/userAsset.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasAnyRolePermission, hasRolePermission } from '../../../common/middlewares/index';

export default (router: express.Router) => {
    router.get('/userToAssets', userAssetController.getUserAssets);
    router.post('/userToAssets', hasAnyRolePermission('asset', ['add_asset', 'edit_asset']), userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', validateParam("assetId"), hasRolePermission('asset', 'edit_asset'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', hasRolePermission('asset', 'edit_asset'), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', userAssetMailFlagsValidator, validate, userAssetController.updateSendMailFlag);
}
