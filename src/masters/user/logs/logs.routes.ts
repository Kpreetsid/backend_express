import express from 'express';
import { userLogsController } from './logs.controller';
import { hasAccountFeature } from '../../../middlewares/permission';

export default (router: express.Router) => {
    const userLogRouter = express.Router();
    userLogRouter.get('/', hasAccountFeature('users'), userLogsController.userLogs);
    router.use('/logs', userLogRouter);
}
