import { Router } from 'express';
import { cryptoRouter } from '../crypto.routes';
import { accountPermissionEventRoutes } from '../accountPermissionEvent.routes';

export const createInternalRouter = (): Router => {
  const router = Router();
  router.use('/crypto', cryptoRouter);
  router.use('/internal/account-permissions', accountPermissionEventRoutes());
  return router;
};

export default createInternalRouter;
