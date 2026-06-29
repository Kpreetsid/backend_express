import express from 'express';
import caseRoutes from './case/case.routes';
import insightsRoutes from './insights/insights.routes';

const router = express.Router();

export default (): express.Router => {
  caseRoutes(router);
  insightsRoutes(router);
  return router;
};
