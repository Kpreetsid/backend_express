import express from 'express';
import { userLocationController } from './userLocation.controller';
import { userLocationValidator, userLocationUpdateValidator } from './userLocation.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    router.get('/userToLocations', userLocationController.getUserLocations);
    router.post('/userToLocations', hasRolePermission('location', 'edit_location'), userLocationValidator, validate, userLocationController.setUserLocations);
    router.put('/userToLocations', hasRolePermission('location', 'edit_location'), userLocationUpdateValidator, validate, userLocationController.updateUserLocations);
    router.patch('/userToLocations', hasRolePermission('location', 'edit_location'), userLocationUpdateValidator, validate, userLocationController.updateUserLocations);
}
