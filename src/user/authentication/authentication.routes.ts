import express from 'express';
import { authentication, authenticationToken, externalToken, authenticationByToken, resetPassword, userLogOut, refreshAccessToken, getMe } from '../authentication/authentication.controller';
import { isLogOutAuthenticated, verifyEncryptedToken } from '../../_config/auth';
import { rateLimiter } from '../../middlewares/rateLimits';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', rateLimiter.authLimiter, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    userRouter.get('/create_external_token/:email', rateLimiter.authLimiter, externalToken);
    userRouter.post('/external_auth', rateLimiter.authLimiter, verifyEncryptedToken, authenticationByToken);
    userRouter.post('/refresh', rateLimiter.authLimiter, refreshAccessToken);
    userRouter.post('/updatePassword', rateLimiter.passwordResetValidateLimiter, resetPassword);
    userRouter.get('/logout', isLogOutAuthenticated, userLogOut);
    userRouter.get('/me', getMe);
    router.post('/auth/refresh', rateLimiter.authLimiter, refreshAccessToken);
    router.use('/users', userRouter);
}
