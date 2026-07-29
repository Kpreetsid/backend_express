import express from 'express';
import { userController } from './user.controller';
import rolesRoutes from './role/roles.routes';
import userLogRouters from './logs/logs.routes';
import { validateParamId } from '../../middlewares/validate';
import { userValidator } from './user.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
    userRouter.get('/', hasAccountFeature('users'), userController.getUsers);
    userRouter.get('/:id', hasAccountFeature('users'), validateParamId, userController.getUser);
    userRouter.get('/location/:id', hasAccountFeature('users'), validateParamId, userController.getLocationWiseUsers);
    userRouter.post('/', hasAccountFeature('users', 'add'), userValidator, validate, userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', hasAccountFeature('users', 'edit'), validateParamId, userController.updateUser);
    userRouter.patch('/:id', hasAccountFeature('users', 'edit'), validateParamId, userController.updateUser);
    userRouter.delete('/:id', hasAccountFeature('users', 'delete'), validateParamId, userController.removeUser);
    router.use('/users', userRouter);
}
