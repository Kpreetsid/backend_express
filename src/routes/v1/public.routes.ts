import { registerEmailLoginRoutes } from '@modules/auth/email-login/email-login.routes';
import { Router } from 'express';
import createAuthRouter from '../../modules/auth/routes/auth.routes';

export const createPublicRouter = (): Router => {
  const router = Router();
  registerEmailLoginRoutes(router);
  router.use('/', createAuthRouter());
  return router;
};

export default createPublicRouter;
