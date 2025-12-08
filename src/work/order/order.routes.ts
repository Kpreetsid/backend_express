import express from 'express';
import { orderController } from './order.controller';
import commentsRoutes from '../comments/comment.routes';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const orderRouter = express.Router();
    orderRouter.get('/', orderController.getAll);
    orderRouter.get('/status', orderController.getOrderStatus);
    orderRouter.get('/summary', orderController.getSummaryData);
    orderRouter.get('/pending', orderController.getPendingOrders);
    orderRouter.get('/priority', orderController.getOrderPriority);
    orderRouter.get('/monthly-count', orderController.getMonthlyCount);
    orderRouter.get('/planned-unplanned', orderController.getPlannedUnplanned);
    orderRouter.get('/get-work-order', orderController.getAllWorkOrders);
    orderRouter.get('/:id', orderController.getOrderById);
    orderRouter.post('/', hasRolePermission('workOrder', 'create_work_order'), orderController.createOrder);
    orderRouter.put('/status/:id', hasRolePermission('workOrder', 'update_work_order_status'), orderController.statusUpdateOrder);
    orderRouter.put('/:id', orderController.updateOrder);
    orderRouter.delete('/:id', hasRolePermission('workOrder', 'delete_work_order'), orderController.remove);
    const commentRouter = express.Router({ mergeParams: true });
    orderRouter.use("/:id/comments", commentsRoutes(commentRouter));
    router.use('/orders', orderRouter);
};