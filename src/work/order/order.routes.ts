import express from 'express';
import { getAll, getOrderById, createOrder, updateOrder, remove, getOrderStatus, getOrderPriority, statusUpdateOrder, getMonthlyCount, getPlannedUnplanned, getSummaryData, getPendingOrders } from './order.controller';
import commentsRoutes from '../comments/comment.routes';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const orderRouter = express.Router();
    orderRouter.get('/', getAll);
    orderRouter.get('/status', getOrderStatus);
    orderRouter.get('/summary', getSummaryData);
    orderRouter.get('/pending', getPendingOrders);
    orderRouter.get('/priority', getOrderPriority);
    orderRouter.get('/monthly-count', getMonthlyCount);
    orderRouter.get('/planned-unplanned', getPlannedUnplanned);
    orderRouter.get('/:id', getOrderById);
    orderRouter.post('/', hasRolePermission('workOrder', 'create_work_order'), createOrder);
    orderRouter.put('/status/:id', hasRolePermission('workOrder', 'update_work_order_status'), statusUpdateOrder);
    orderRouter.put('/:id', hasRolePermission('workOrder', 'edit_work_order'), updateOrder);
    orderRouter.delete('/:id', hasRolePermission('workOrder', 'delete_work_order'), remove);
    const commentRouter = express.Router({ mergeParams: true });
    orderRouter.use("/:id/comments", commentsRoutes(commentRouter));
    router.use('/orders', orderRouter);
};