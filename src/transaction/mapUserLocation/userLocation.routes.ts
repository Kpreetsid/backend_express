import express from 'express';
import { getUserLocations, getUserAssets, setUserLocations, updateUserLocations, updateSendMailFlag } from './userLocation.controller';
import { isOwnerOrAdmin } from '../../middlewares';

export default (router: express.Router) => {
    router.get('/userToLocations', getUserLocations);
    router.post('/userToLocations', setUserLocations);
    router.put('/userToLocations', updateUserLocations);
    router.get('/userToAssets', getUserAssets);
    router.post('/userToAssets', isOwnerOrAdmin, updateSendMailFlag);
}