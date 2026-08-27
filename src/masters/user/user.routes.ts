import express from 'express';
import { userController } from './user.controller';
import rolesRoutes from './role/roles.routes';
import userLogRouters from './logs/logs.routes';
import { validateParamId } from '../../middlewares/validate';

import { userUpdateValidator, userValidator } from './user.validator';
import { validate } from '../../middlewares/validator.middleware';


export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);

    userRouter.get('/', userController.getUsers);
    userRouter.get('/:id', validateParamId, userController.getUser);
    userRouter.get('/location/:locationID', userController.getLocationWiseUsers);
    userRouter.post('/', userValidator, validate, userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', validateParamId, userUpdateValidator, validate, userController.updateUser);
    userRouter.patch('/:id', validateParamId, userUpdateValidator, validate, userController.updateUser);
    userRouter.delete('/:id', validateParamId, userController.removeUser);

    router.use('/users', userRouter);
}

