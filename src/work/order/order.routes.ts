import express from 'express';
import { getOrders, getOrder, getFilterOrders, createOrder, updateOrder, removeOrder } from './order.controller';
import { hasPermission } from '../../_config/permission';

export default (router: express.Router) => {
    const orderRouter = express.Router();
    orderRouter.get('/', getOrders);
    orderRouter.get('/filter', getFilterOrders);
    orderRouter.get('/:id', getOrder);
    orderRouter.post('/', createOrder);
    orderRouter.put('/:id', updateOrder);
    orderRouter.delete('/:id', hasPermission('admin'),removeOrder);
    router.use('/orders', orderRouter);
}