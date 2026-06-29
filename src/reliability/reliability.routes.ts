import express from 'express';
import caseRoutes from './case/case.routes';

const router = express.Router();

export default (): express.Router => {
  caseRoutes(router);
  return router;
};
