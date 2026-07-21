import express from 'express';
import orderRoutes from './order/order.routes';
import requestRoutes from './request/request.routes';
import instructionsRoutes from './instruction/instruction.routes';
import procedureRoutes from './procedure/procedure.routes';
import orderTemplateRoutes from './orderTemplate/orderTemplate.routes';
import { hasAccountFeature, hasAnyAccountFeature } from '../middlewares/permission';
const router = express.Router();

const withAccountFeature = (
  menuKey: string,
  registerRoutes: (router: express.Router) => void
): express.Router => {
  const featureRouter = express.Router();
  featureRouter.use(hasAccountFeature(menuKey));
  registerRoutes(featureRouter);
  return featureRouter;
};

export default (): express.Router => {
    router.use(withAccountFeature('master_work_order', orderRoutes));
    router.use(withAccountFeature('master_library', orderTemplateRoutes));
    router.use(withAccountFeature('master_work_request', requestRoutes));
    const instructionRouter = express.Router();
    instructionRouter.use(hasAnyAccountFeature(['master_asset', 'master_location', 'master_work_order']));
    instructionsRoutes(instructionRouter);
    router.use(instructionRouter);
    router.use(withAccountFeature('master_library', procedureRoutes));
    return router;
}
