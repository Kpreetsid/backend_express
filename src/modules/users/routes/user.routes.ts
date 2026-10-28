import express from 'express';
import { userController } from '../controllers/user.controller';
import rolesRoutes from './roles.routes';
import userLogRouters from './logs.routes';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { userValidator } from '../validators/user.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
    userRouter.get('/', userController.getUsers);
    userRouter.get('/location/:id', validateParamId, userController.getLocationWiseUsers);
    userRouter.get('/:id', validateParamId, userController.getUser);
    userRouter.post('/', userValidator, validate, userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', validateParamId, userController.updateUser);
    userRouter.patch('/:id', validateParamId, userController.updateUser);
    userRouter.delete('/:id', validateParamId, userController.removeUser);
    router.use('/users', userRouter);
}

