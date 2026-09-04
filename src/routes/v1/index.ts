import { Router } from 'express';
import createPublicRouter from './public.routes';
import createProtectedRouter from './protected.routes';
import createInternalRouter from './internal.routes';

export const createV1Router = (): Router => {
  const router = Router();
  router.use(createInternalRouter());
  router.use(createPublicRouter());
  router.use(createProtectedRouter());
  return router;
};

export default createV1Router;
