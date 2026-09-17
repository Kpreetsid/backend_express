import express from 'express';
import { rateLimiter } from '../../middlewares/rateLimits';
import { validateParam } from '../../middlewares/validate';
import { generateAccountApiKey, getAccountApiKey, removeAccountApiKey } from './account.controller';

export default (router: express.Router) => {
    const accountDownloadApiKeyRouter = express.Router();
    accountDownloadApiKeyRouter.get('/:accountId', rateLimiter.authLimiter, validateParam('accountId'), getAccountApiKey);
    accountDownloadApiKeyRouter.post('/:accountId', rateLimiter.authLimiter, validateParam('accountId'), generateAccountApiKey);
    accountDownloadApiKeyRouter.delete('/:accountId', rateLimiter.authLimiter, validateParam('accountId'), removeAccountApiKey);
    router.use('/account/download-api-key', accountDownloadApiKeyRouter);
}
