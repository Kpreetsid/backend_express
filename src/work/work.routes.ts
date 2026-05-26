import express from 'express';
import orderRoutes from './order/order.routes';
import requestRoutes from './request/request.routes';
import instructionsRoutes from './instruction/instruction.routes';
import procedureRoutes from './procedure/procedure.routes';
import orderTemplateRoutes from './orderTemplate/orderTemplate.routes';
const router = express.Router();

export default (): express.Router => {
    orderRoutes(router);
    orderTemplateRoutes(router);
    requestRoutes(router);
    instructionsRoutes(router);
    procedureRoutes(router);
    return router;
}
