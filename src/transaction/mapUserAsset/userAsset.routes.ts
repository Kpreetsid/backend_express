import express from 'express';
import { userAssetController } from './userAsset.controller';
import { validateParam } from '../../middlewares/validate';
import { userAssetValidator, userAssetUpdateValidator } from './userAsset.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    router.get('/userToAssets', userAssetController.getUserAssets);
    router.post('/userToAssets', userAssetValidator, validate, userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', validateParam("assetId"), userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.patch('/userToAssets', userAssetUpdateValidator, validate, userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', userAssetController.updateSendMailFlag);
}