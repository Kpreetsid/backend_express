import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { userLocationController } from '../controllers/userLocation.controller';
import { userLocationValidator, userLocationUpdateValidator } from '../validators/userLocation.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.get('/userToLocations', hasRolePermission('users', 'view'), userLocationController.getUserLocations);
    router.post('/userToLocations', hasRolePermission('users', 'edit'), userLocationValidator, validate, userLocationController.setUserLocations);
    router.put('/userToLocations', hasRolePermission('users', 'edit'), userLocationUpdateValidator, validate, userLocationController.updateUserLocations);
    router.patch('/userToLocations', hasRolePermission('users', 'edit'), userLocationUpdateValidator, validate, userLocationController.updateUserLocations);
}