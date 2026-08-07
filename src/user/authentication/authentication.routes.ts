import express from 'express';
import { authentication, authenticationToken, externalToken, authenticationByToken, resetPassword, userLogOut, refreshAccessToken } from '../authentication/authentication.controller';
import { isLogOutAuthenticated, verifyEncryptedToken } from '../../_config/auth';
import { rateLimiter } from '../../middlewares/rateLimits';
import { checkPasswordExpire } from '../../middlewares/passwordExpire';
import { isProcessorAuthenticated } from '../../_config/processorAuth';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', rateLimiter.authLimiter, checkPasswordExpire, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    userRouter.get('/create_external_token/:email', rateLimiter.authLimiter, isProcessorAuthenticated, externalToken);
    userRouter.post('/external_auth', rateLimiter.authLimiter, verifyEncryptedToken, authenticationByToken);
    userRouter.post('/refresh', rateLimiter.authLimiter, refreshAccessToken);
    userRouter.post('/updatePassword', rateLimiter.passwordResetValidateLimiter, resetPassword);
    userRouter.get('/logout', isLogOutAuthenticated, userLogOut);
    router.use('/users', userRouter);
}
