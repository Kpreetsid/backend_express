import express from 'express';
import { getUserWorkOrders, getMappedData } from './userWorkOrder.controller';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/workOrders', getUserWorkOrders);
    workOrderRouter.get('/workOrders/:workOrderId', getMappedData);
    router.use('/users', workOrderRouter);
}