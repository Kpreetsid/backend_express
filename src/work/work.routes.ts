import express from 'express';
import orderRoutes from './order/order.routes';
import requestRoutes from './request/request.routes';
import instructionsRoutes from './instruction/instruction.routes';
const router = express.Router();

export default (): express.Router => {
    orderRoutes(router);
    requestRoutes(router);
    instructionsRoutes(router);
    return router;
}