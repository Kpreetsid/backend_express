import express from 'express';
import orderRoutes from './order/order.routes';
import commentsRoutes from './comments/comment.routes';
import requestRoutes from './request/request.routes';
const router = express.Router();

export default (): express.Router => {
    orderRoutes(router);
    requestRoutes(router);
    commentsRoutes(router);
    return router;
}