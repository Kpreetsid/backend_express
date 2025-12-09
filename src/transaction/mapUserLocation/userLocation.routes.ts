import express from 'express';
import { userLocationController } from './userLocation.controller';

export default (router: express.Router) => {
    router.get('/userToLocations', userLocationController.getUserLocations);
    router.post('/userToLocations', userLocationController.setUserLocations);
    router.put('/userToLocations', userLocationController.updateUserLocations);
    router.get('/userToAssets', userLocationController.getUserAssets);
    router.post('/userToAssets', userLocationController.setUserAssets);
    router.put('/userToAssets/:assetId', userLocationController.updateUserAssets);
    router.post('/updateAssetsFlags', userLocationController.updateSendMailFlag);
}