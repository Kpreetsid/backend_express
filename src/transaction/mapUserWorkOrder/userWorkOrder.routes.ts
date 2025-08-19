import express from 'express';
import { getUserWorkOrders, getMappedData, setUserWorkOrders } from './userWorkOrder.controller';

export default (router: express.Router) => {
    const workOrderRouter = express.Router();
    workOrderRouter.get('/workOrders', getUserWorkOrders);
    workOrderRouter.get('/workOrders/:workOrderId', getMappedData);
     workOrderRouter.post('/workOrders', setUserWorkOrders);
    router.use('/users', workOrderRouter);
}