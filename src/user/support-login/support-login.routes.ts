import { Router } from 'express';
import { rateLimiter } from '../../middlewares/rateLimits';
import { issueSupportLogin } from './support-login.controller';

export const supportLoginRoutes = (): Router => {
  const router = Router();
  router.post('/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, rateLimiter.authLimiter, issueSupportLogin);
  return router;
};
