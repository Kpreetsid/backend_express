import express from 'express';
import { userLocationController } from './userLocation.controller';

export default (router: express.Router) => {
    router.get('/userToLocations', userLocationController.getUserLocations);
    router.post('/userToLocations', userLocationController.setUserLocations);
    router.put('/userToLocations', userLocationController.updateUserLocations);
    router.patch('/userToLocations', userLocationController.updateUserLocations);
}