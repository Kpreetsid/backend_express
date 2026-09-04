import { Router } from 'express';
import createAuthRouter from '../../modules/auth/routes/auth.routes';

export const createPublicRouter = (): Router => {
  const router = Router();
  router.use('/', createAuthRouter());
  return router;
};

export default createPublicRouter;
