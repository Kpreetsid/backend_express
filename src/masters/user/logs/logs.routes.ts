import express from 'express';
import { userLogs } from './logs.controller';

export default (router: express.Router) => {
    const userLogRouter = express.Router();
    userLogRouter.get('/', userLogs);
    router.use('/logs', userLogRouter);
}