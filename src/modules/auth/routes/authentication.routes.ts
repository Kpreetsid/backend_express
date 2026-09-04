import express from 'express';
import { authentication, authenticationToken, externalToken, authenticationByToken, resetPassword, userLogOut, refreshAccessToken, getMe, authorizeFeature } from '../controllers/authentication.controller';
import { isAuthenticated, isLogOutAuthenticated, verifyEncryptedToken } from '../../../core/auth/auth.middleware';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', rateLimiter.authLimiter, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    userRouter.get('/create_external_token/:email', rateLimiter.authLimiter, externalToken);
    userRouter.get('/create_external_token/account/:accountId', rateLimiter.authLimiter, externalToken);
    userRouter.post('/external_auth', rateLimiter.authLimiter, verifyEncryptedToken, authenticationByToken);
    userRouter.post('/refresh', rateLimiter.authLimiter, refreshAccessToken);
    userRouter.post('/updatePassword', rateLimiter.passwordResetValidateLimiter, resetPassword);
    userRouter.get('/logout', isLogOutAuthenticated, userLogOut);
    userRouter.get('/me', isAuthenticated, getMe);
    userRouter.post('/authorize-feature', isAuthenticated, authorizeFeature);
    router.post('/auth/refresh', rateLimiter.authLimiter, refreshAccessToken);
    router.use('/users', userRouter);
}
