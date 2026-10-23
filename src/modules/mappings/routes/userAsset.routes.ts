import express from 'express';
import { userAssetController } from '../controllers/userAsset.controller';
import { validateParam } from '../../../common/middlewares/validate.middleware';
import { userAssetValidator, userAssetUpdateValidator } from '../validators/userAsset.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.get('/userToAssets', userAssetController.getUserAssets);
    router.post('/userToAssets', userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', validateParam("assetId"), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', userAssetController.updateSendMailFlag);
}