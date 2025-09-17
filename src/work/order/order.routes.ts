import express from 'express';
import { getAll, createOrder, updateOrder, remove, getOrderStatus, getOrderPriority, statusUpdateOrder, getMonthlyCount, getPlannedUnplanned, getSummaryData, getPendingOrders } from './order.controller';
import commentsRoutes from '../comments/comment.routes';

export default (router: express.Router) => {
    const orderRouter = express.Router();
    orderRouter.get('/', getAll);
    orderRouter.get('/status', getOrderStatus);
    orderRouter.get('/summary', getSummaryData);
    orderRouter.get('/pending', getPendingOrders);
    orderRouter.get('/priority', getOrderPriority);
    orderRouter.get('/monthly-count', getMonthlyCount);
    orderRouter.get('/planned-unplanned', getPlannedUnplanned);
    orderRouter.get('/:id', getAll);
    orderRouter.post('/', createOrder);
    orderRouter.put('/status/:id', statusUpdateOrder);
    orderRouter.put('/:id', updateOrder);
    orderRouter.delete('/:id', remove);
    const commentRouter = express.Router({ mergeParams: true });
    orderRouter.use("/:id/comments", commentsRoutes(commentRouter));
    router.use('/orders', orderRouter);
};