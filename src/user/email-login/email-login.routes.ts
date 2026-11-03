import express, { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../../_config/auth';
import { rateLimiter } from '../../middlewares/rateLimits';
import { openEmailLoginPage, issueEmailLoginToken, inspectEmailLogin, exchangeEmailLogin, listEmailLoginCredentials, revokeEmailLoginCredential, revokeUserEmailLoginCredentials } from './email-login.controller';

const handler = (action: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  Promise.resolve(action(req, res)).catch(next);
};

export function registerEmailLoginRoutes(router: express.Router): void {
  const internalRoutes = express.Router();
  internalRoutes.post('/', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, rateLimiter.authLimiter, handler(issueEmailLoginToken));
  router.use('/internal/email-login-tokens', internalRoutes);
  const emailLoginRoutes: express.Router = express.Router();
  emailLoginRoutes.get('/', handler(openEmailLoginPage));
  emailLoginRoutes.post('/inspect', rateLimiter.authLimiter, handler(inspectEmailLogin));
  emailLoginRoutes.post('/exchange', rateLimiter.authLimiter, handler(exchangeEmailLogin));
  emailLoginRoutes.get('/credentials', isAuthenticated, handler(listEmailLoginCredentials));
  emailLoginRoutes.post('/revoke', isAuthenticated, handler(revokeEmailLoginCredential));
  emailLoginRoutes.post('/revoke-user', isAuthenticated, handler(revokeUserEmailLoginCredentials));
  router.use('/users/email-login', emailLoginRoutes);
}
