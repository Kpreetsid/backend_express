import express from 'express';
import { orderController } from './order.controller';
import commentsRoutes from '../comments/comment.routes';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const orderRouter = express.Router();
    orderRouter.get('/', orderController.getAll);
    orderRouter.get('/get-work-order', orderController.getAllWorkOrders);
    orderRouter.get('/:id', validateParamId, orderController.getOrderById);
    orderRouter.post('/', hasRolePermission('workOrder', 'create_work_order'), orderController.createOrder);
    orderRouter.post('/status', orderController.getOrderStatus);
    orderRouter.post('/summary', orderController.getSummaryData);
    orderRouter.post('/pending', orderController.getPendingOrders);
    orderRouter.post('/priority', orderController.getOrderPriority);
    orderRouter.post('/monthly-count', orderController.getMonthlyCount);
    orderRouter.post('/planned-unplanned', orderController.getPlannedUnplanned);
    orderRouter.put('/status/:id', validateParamId, hasRolePermission('workOrder', 'update_work_order_status'), orderController.statusUpdateOrder);
    orderRouter.put('/:id', validateParamId, orderController.updateOrder);
    orderRouter.patch('/:id', validateParamId, orderController.updateOrderSubmitData);
    orderRouter.delete('/:id', validateParamId, hasRolePermission('workOrder', 'delete_work_order'), orderController.remove);
    const commentRouter = express.Router({ mergeParams: true });
    orderRouter.use("/:id/comments", commentsRoutes(commentRouter));
    router.use('/orders', orderRouter);
};