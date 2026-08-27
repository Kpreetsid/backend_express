import express from 'express';
import { userController } from './user.controller';
import rolesRoutes from './role/roles.routes';
import userLogRouters from './logs/logs.routes';
import { validateParamId } from '../../middlewares/validate';
<<<<<<< Updated upstream
import { userValidator } from './user.validator';
import { validate } from '../../middlewares/validator.middleware';
=======
import { userUpdateValidator, userValidator } from './user.validator';
import { validate } from '../../middlewares/validator.middleware';
>>>>>>> Stashed changes

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
<<<<<<< Updated upstream
    userRouter.get('/', userController.getUsers);
    userRouter.get('/:id', validateParamId, userController.getUser);
    userRouter.get('/location/:id', validateParamId, userController.getLocationWiseUsers);
    userRouter.post('/', userValidator, validate, userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', validateParamId, userController.updateUser);
    userRouter.patch('/:id', validateParamId, userController.updateUser);
    userRouter.delete('/:id', validateParamId, userController.removeUser);
=======
    userRouter.get('/', userController.getUsers);
    userRouter.get('/:id', validateParamId, userController.getUser);
    userRouter.get('/location/:locationID', userController.getLocationWiseUsers);
    userRouter.post('/', userValidator, validate, userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', validateParamId, userUpdateValidator, validate, userController.updateUser);
    userRouter.patch('/:id', validateParamId, userUpdateValidator, validate, userController.updateUser);
    userRouter.delete('/:id', validateParamId, userController.removeUser);
>>>>>>> Stashed changes
    router.use('/users', userRouter);
}

