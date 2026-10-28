import express from 'express';
import { userController } from '../controllers/user.controller';
import rolesRoutes from './roles.routes';
import userLogRouters from './logs.routes';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { userValidator } from '../validators/user.validator';
import { validate } from '../../../common/middlewares/validator.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

export default (router: express.Router) => {
    const userRouter = express.Router();
    rolesRoutes(userRouter);
    userLogRouters(userRouter);
    userRouter.get('/', hasRolePermission('users', 'view'), userController.getUsers);
    userRouter.get('/location/:id', hasRolePermission('users', 'view'), validateParamId, userController.getLocationWiseUsers);
    userRouter.get('/:id', hasRolePermission('users', 'view'), validateParamId, userController.getUser);
    userRouter.post('/', hasRolePermission('users', 'add'), userValidator, validate, userController.createUser);
    userRouter.post('/change-password', userController.updatePasswordUser);
    userRouter.put('/:id', hasRolePermission('users', 'edit'), validateParamId, userController.updateUser);
    userRouter.patch('/:id', hasRolePermission('users', 'edit'), validateParamId, userController.updateUser);
    userRouter.delete('/:id', hasRolePermission('users', 'delete'), validateParamId, userController.removeUser);
    router.use('/users', userRouter);
}

