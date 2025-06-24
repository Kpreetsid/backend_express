import express from 'express';
import { getUserLocations, getUserAssets, setUserLocations, updateUserLocations } from './userLocation.controller';

export default (router: express.Router) => {
    router.get('/userToLocations', getUserLocations);
    router.post('/userToLocations', setUserLocations);
    router.put('/userToLocations', updateUserLocations);
    router.get('/userToAssets', getUserAssets);
}