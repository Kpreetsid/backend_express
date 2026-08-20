import express from 'express';
import { authentication, authenticationToken, externalToken, authenticationByToken, resetPassword, userLogOut } from '../authentication/authentication.controller';
import { isLogOutAuthenticated, verifyEncryptedToken } from '../../_config/auth';
import { rateLimiter } from '../../middlewares/rateLimits';
import { checkPasswordExpire } from '../../middlewares/passwordExpire';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', rateLimiter.authLimiter, checkPasswordExpire, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    userRouter.get('/create_external_token/:email', rateLimiter.authLimiter, externalToken);
    userRouter.get('/create_external_token/account/:accountId', rateLimiter.authLimiter, externalToken);
    userRouter.post('/external_auth', rateLimiter.authLimiter, verifyEncryptedToken, authenticationByToken);
    userRouter.post('/updatePassword', rateLimiter.passwordResetValidateLimiter, resetPassword);
    userRouter.get('/logout', isLogOutAuthenticated, userLogOut);
    router.use('/users', userRouter);
}