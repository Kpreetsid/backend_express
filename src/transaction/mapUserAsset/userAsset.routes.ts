import express from 'express';
import { userAssetController } from './userAsset.controller';

export default (router: express.Router) => {
    router.get('/userToAssets', userAssetController.getUserAssets);
    router.post('/userToAssets', userAssetController.setUserAssets);
    router.put('/userToAssets/:assetId', userAssetController.updateUserAssets);
    router.patch('/userToAssets', userAssetController.updateUserAssets);
    router.post('/updateAssetsFlags', userAssetController.updateSendMailFlag);
}