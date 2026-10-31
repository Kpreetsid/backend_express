import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { userLogsController } from '@modules/users/controllers/logs.controller';

export default (router: express.Router) => {
    const userLogRouter = express.Router();
    userLogRouter.use(hasRolePermission('users', 'view'));
    userLogRouter.get('/', userLogsController.userLogs);
    router.use('/logs', userLogRouter);
}

