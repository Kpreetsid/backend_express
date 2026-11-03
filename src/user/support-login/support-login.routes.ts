import { Router } from 'express';
import { rateLimiter } from '../../middlewares/rateLimits';
import { issueSupportLogin } from './support-login.controller';

export const supportLoginRoutes = (): Router => {
  const router = Router();
  router.post('/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.once('finish', () => {
      console.info('support-login-response', {
        correlationId: res.locals.correlationId,
        statusCode: res.statusCode,
        method: req.method,
        path: `${req.baseUrl}${req.path}`
      });
    });
    next();
  }, rateLimiter.authLimiter, issueSupportLogin);
  return router;
};
