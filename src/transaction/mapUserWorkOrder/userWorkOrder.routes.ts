import express from 'express';
import { getUserWorkOrders } from './userWorkOrder.controller';

export default (router: express.Router) => {
    router.get('/userToWorkOrders', getUserWorkOrders);
}