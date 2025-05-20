import express from 'express';
import { getOrders, getOrder, createOrder, updateOrder, removeOrder } from './order.controller';

export default (router: express.Router) => {
    router.get('/orders', getOrders);
    router.get('/order/:id', getOrder);
    router.post('/order', createOrder);
    router.put('/order/:id', updateOrder);
    router.delete('/order/:id', removeOrder);
}