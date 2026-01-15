import express from 'express';
import { userController } from './user.controller';
import rolesRoutes from './role/roles.routes';
import userLogRouters from './logs/logs.routes';

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
    userRouter.get('/', userController.getUsers);
    userRouter.get('/:id', userController.getUser);
    userRouter.get('/location/:id', userController.getLocationWiseUsers);
    userRouter.post('/', userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', userController.updateUser);
    userRouter.patch('/:id', userController.updateUser);
    userRouter.delete('/:id', userController.removeUser);
    router.use('/users', userRouter);
}