import express from 'express';
import { authentication, authenticationToken, externalToken, authenticationByToken, resetPassword, userLogOut, refreshAccessToken, getMe, authorizeFeature } from '../controllers/authentication.controller';
import { isAuthenticated, isLogOutAuthenticated } from '../../../core/auth/auth.middleware';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';
import { checkPasswordExpire } from '../../../common/middlewares/password-expire.middleware';
import { requireSupportLoginService } from '../../../core/auth/support-login.middleware';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', rateLimiter.authLimiter, checkPasswordExpire, authentication);
    userRouter.post('/authenticate', rateLimiter.authLimiter, authenticationToken);
    userRouter.post('/create_external_token', rateLimiter.authLimiter, requireSupportLoginService, externalToken);
    userRouter.post('/external_auth', rateLimiter.authLimiter, authenticationByToken);
    userRouter.post('/refresh', rateLimiter.authLimiter, refreshAccessToken);
    userRouter.post('/updatePassword', rateLimiter.passwordResetValidateLimiter, resetPassword);
    // Browser cookies require a CSRF-protected state-changing POST. Keep
    // bearer-only GET for integrations during the bounded migration.
    userRouter.get('/logout', (req, res, next) => {
        if (!/^Bearer\s+\S+$/i.test(String(req.get('authorization') || ''))) {
            return res.status(405).json({ status: false, message: 'Use POST to log out' });
        }
        next();
    }, isLogOutAuthenticated, userLogOut);
    userRouter.post('/logout', isLogOutAuthenticated, userLogOut);
    userRouter.get('/me', isAuthenticated, getMe);
    userRouter.post('/authorize-feature', isAuthenticated, authorizeFeature);
    router.post('/auth/refresh', rateLimiter.authLimiter, refreshAccessToken);
    router.use('/users', userRouter);
}
