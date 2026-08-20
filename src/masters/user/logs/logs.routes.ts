import express from 'express';
import { userLogsController } from './logs.controller';

export default (router: express.Router) => {
    const userLogRouter = express.Router();
    userLogRouter.get('/', userLogsController.userLogs);
    router.use('/logs', userLogRouter);
}

