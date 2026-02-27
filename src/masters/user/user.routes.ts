import express from 'express';
import { userController } from './user.controller';
import rolesRoutes from './role/roles.routes';
import userLogRouters from './logs/logs.routes';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
    userRouter.get('/', userController.getUsers);
    userRouter.get('/:id', validateParamId, userController.getUser);
    userRouter.get('/location/:id', validateParamId, userController.getLocationWiseUsers);
    userRouter.post('/', userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', validateParamId, userController.updateUser);
    userRouter.patch('/:id', validateParamId, userController.updateUser);
    userRouter.delete('/:id', validateParamId, userController.removeUser);
    router.use('/users', userRouter);
}