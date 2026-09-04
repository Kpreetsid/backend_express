import { Router } from 'express';
import userAuth from './authentication.routes';
import userRegister from './registration.routes';
import userTokenRoutes from './userToken.routes';
import userResetPassword from './resetPassword.routes';
import userVerification from './verification.routes';

export const createAuthRouter = (): Router => {
  const router = Router();
  userRegister(router);
  userAuth(router);
  userTokenRoutes(router);
  userResetPassword(router);
  userVerification(router);
  return router;
};

export default createAuthRouter;
