import express from 'express';
import { userLogs } from './logs.controller';

export default (router: express.Router) => {
    router.get('/users/logs', userLogs);
}