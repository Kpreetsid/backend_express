import express from 'express';
import { getUserLocations, getUserAssets, setUserLocations, setUserAssets, updateUserAssets, updateUserLocations, updateSendMailFlag } from './userLocation.controller';

export default (router: express.Router) => {
    router.get('/userToLocations', getUserLocations);
    router.post('/userToLocations', setUserLocations);
    router.put('/userToLocations', updateUserLocations);
    router.get('/userToAssets', getUserAssets);
    router.post('/userToAssets', setUserAssets);
    router.put('/userToAssets/:assetId', updateUserAssets);
    router.post('/updateAssetsFlags', updateSendMailFlag);
}