import { Router } from 'express';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';
import { issueSupportToken } from './support-login.controller';

export const supportLoginRoutes = (): Router => {
  const router = Router();
  router.get('/', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Allow', 'POST');
    res.status(405).json({ status: false, message: 'Use POST to issue a support login token' });
  });
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
  }, rateLimiter.authLimiter, issueSupportToken);
  return router;
};
