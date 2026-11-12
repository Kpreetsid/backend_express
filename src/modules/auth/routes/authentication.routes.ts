import express from 'express';
import { authentication, authenticationToken, authenticationByToken, resetPassword, userLogOut, refreshAccessToken, getMe, authorizeFeature, externalToken } from '../controllers/authentication.controller';
import { isAuthenticated, isLogOutAuthenticated, verifyEncryptedToken } from '../../../core/auth/auth.middleware';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';
import { verifyTwoStepAuthentication, resendTwoStepAuthentication } from '../../../user/two-step/two-step.controller';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    userRouter.post('/two-step/verify', rateLimiter.twoStepVerifyLimiter, verifyTwoStepAuthentication);
    userRouter.post('/two-step/resend', rateLimiter.twoStepSendLimiter, resendTwoStepAuthentication);
    userRouter.post('/login', rateLimiter.authLimiter, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    userRouter.get('/create_external_token/:email', rateLimiter.authLimiter, externalToken);
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
