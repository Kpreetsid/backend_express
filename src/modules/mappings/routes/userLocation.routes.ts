import express from 'express';
import { userLocationController } from '../controllers/userLocation.controller';
import { userLocationValidator, userLocationUpdateValidator } from '../validators/userLocation.validator';
import { validate } from '../../../common/middlewares/validate.middleware';

export default (router: express.Router) => {
    router.get('/userToLocations', userLocationController.getUserLocations);
    router.post('/userToLocations', userLocationValidator, validate, userLocationController.setUserLocations);
    router.put('/userToLocations', userLocationUpdateValidator, validate, userLocationController.updateUserLocations);
    router.patch('/userToLocations', userLocationUpdateValidator, validate, userLocationController.updateUserLocations);
}