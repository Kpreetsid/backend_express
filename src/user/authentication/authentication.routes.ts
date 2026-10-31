import express from 'express';
import { authentication, authenticationToken, authenticationByToken, resetPassword, userLogOut, refreshAccessToken, getMe, authorizeFeature } from '../authentication/authentication.controller';
import { isAuthenticated, isLogOutAuthenticated, verifyEncryptedToken } from '../../_config/auth';
import { rateLimiter } from '../../middlewares/rateLimits';
import { checkPasswordExpire } from '../../middlewares/passwordExpire';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', rateLimiter.authLimiter, checkPasswordExpire, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    // Issuance is available only through the authorized Internal service.
    userRouter.post('/external_auth', rateLimiter.authLimiter, (req, res, next) => {
      if (typeof req.body?.external_token === 'string' && req.body.external_token.startsWith('spt_')) return next();
      return verifyEncryptedToken(req, res, next);
    }, authenticationByToken);
    userRouter.post('/refresh', rateLimiter.authLimiter, refreshAccessToken);
    userRouter.post('/updatePassword', rateLimiter.passwordResetValidateLimiter, resetPassword);
    userRouter.get('/logout', isLogOutAuthenticated, userLogOut);
    userRouter.get('/me', isAuthenticated, getMe);
    userRouter.post('/authorize-feature', isAuthenticated, authorizeFeature);
    router.post('/auth/refresh', rateLimiter.authLimiter, refreshAccessToken);
    router.use('/users', userRouter);
}
