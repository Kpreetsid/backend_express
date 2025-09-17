import express from 'express';
import { getUsers, getUser, createUser, updateUser, updatePasswordUser, removeUser, getLocationWiseUsers } from './user.controller';
import { isOwnerOrAdmin } from '../../middlewares';
import rolesRoutes from './role/roles.routes';
import userLogRouters from './logs/logs.routes';

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
    userRouter.get('/', getUsers);
    userRouter.get('/:id', getUser);
    userRouter.get('/location/:id', getLocationWiseUsers);
    userRouter.post('/', createUser);
    userRouter.post('/change-password', isOwnerOrAdmin, updatePasswordUser);
    userRouter.put('/:id', isOwnerOrAdmin, updateUser);
    userRouter.delete('/:id', isOwnerOrAdmin, removeUser);
    router.use('/users', userRouter);
}