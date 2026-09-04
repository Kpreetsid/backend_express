import { Router } from 'express';
import orderRoutes from './order.routes';
import orderTemplateRoutes from './orderTemplate.routes';
import requestRoutes from './request.routes';
import instructionsRoutes from './instruction.routes';
import procedureRoutes from './procedure.routes';

export const createWorkOrdersRouter = (): Router => {
  const router = Router();
  orderRoutes(router);
  orderTemplateRoutes(router);
  requestRoutes(router);
  const instructionRouter = Router();
  instructionsRoutes(instructionRouter);
  router.use(instructionRouter);
  procedureRoutes(router);
  return router;
};

export default createWorkOrdersRouter;
