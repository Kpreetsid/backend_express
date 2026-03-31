import express from 'express';
import { rateLimiter } from './middlewares/rateLimits';
const router = express.Router();
import userAuth from './user/authentication/authentication.routes';
import userRegister from './user/registration/registration.routes';
import userTokenRoutes from './user/token/userToken.routes';
import userResetPassword from './user/resetPassword/resetPassword.routes';
import userVerification from './user/verification/verification.routes';

export default (): express.Router => {
    router.use(rateLimiter.authLimiter);
    userRegister(router);
    userAuth(router);
    userTokenRoutes(router);
    userResetPassword(router);
    userVerification(router);
    return router;
}