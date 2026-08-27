import express from 'express';
import orderRoutes from './order/order.routes';
import requestRoutes from './request/request.routes';
import instructionsRoutes from './instruction/instruction.routes';
import procedureRoutes from './procedure/procedure.routes';
import orderTemplateRoutes from './orderTemplate/orderTemplate.routes';
// import { hasAnyAccountFeature } from '../middlewares/permission';
const router = express.Router();

// const withAccountFeature = (
//   menuKey: string,
//   registerRoutes: (router: express.Router) => void
// ): express.Router => {
//   const featureRouter = express.Router();
//   featureRouter.use(hasAccountFeature(menuKey));
//   registerRoutes(featureRouter);
//   return featureRouter;
// };

export default (): express.Router => {
  orderRoutes(router);
  orderTemplateRoutes(router);
  requestRoutes(router);
  const instructionRouter = express.Router();
  // instructionRouter.use(hasAnyAccountFeature(['asset', 'location', 'work_order']));
  instructionsRoutes(instructionRouter);
  router.use(instructionRouter);
  procedureRoutes(router);
  return router;
}
