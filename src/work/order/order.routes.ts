import express from 'express';
import { getOrders, getOrder, createOrder, updateOrder, removeOrder, getOrderStatus, getOrderPriority, getMonthlyCount, getPlannedUnplanned, getSummaryData, getPendingOrders } from './order.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const orderRouter = express.Router();
    orderRouter.get('/', getOrders);
    orderRouter.get('/status', getOrderStatus);
    orderRouter.get('/summary', getSummaryData);
    orderRouter.get('/pending', getPendingOrders);
    orderRouter.get('/priority', getOrderPriority);
    orderRouter.get('/monthly-count', getMonthlyCount);
    orderRouter.get('/planned-unplanned', getPlannedUnplanned);
    orderRouter.get('/:id', getOrder);
    orderRouter.post('/', createOrder);
    orderRouter.put('/:id', updateOrder);
    orderRouter.delete('/:id', hasPermission('admin'), removeOrder);
    router.use('/orders', orderRouter);
}