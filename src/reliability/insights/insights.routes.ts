import express from 'express';
import { reliabilityInsightsController } from './insights.controller';
import { hasReliabilityPermission } from '../middlewares/permission';

export default (router: express.Router) => {
  const insightsRouter = express.Router();

  insightsRouter.get('/summary', hasReliabilityPermission('view_business_impact'), reliabilityInsightsController.getSummary);
  insightsRouter.get('/failure-library', hasReliabilityPermission('manage_failure_library'), reliabilityInsightsController.getFailureLibrary);

  router.use('/insights', insightsRouter);
};
