import express from 'express';
import { companyController } from './company.controller';
import { validateParamId } from '../../middlewares/validate';
import { companyValidator } from './company.validator';
import { validate } from '../../middlewares/validator.middleware';
import { requireFirstUser } from '../../middlewares/firstUser.middleware';
import { getTwoStepSettings, updateTwoStepSettings } from './two-step-settings.controller';
import { companyProfileController } from './company-profile.controller';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.patch('/profile', companyProfileController.updateProfile);
    companyRouter.get('/two-step-auth', getTwoStepSettings);
    companyRouter.patch('/two-step-auth', updateTwoStepSettings);
    companyRouter.get('/subscription-limits', companyController.getSubscriptionLimits);
    companyRouter.get('/api-key', requireFirstUser, companyController.getApiKey);
    companyRouter.post('/api-key/generate', requireFirstUser, companyController.generateApiKey);
    companyRouter.post('/api-key/regenerate', requireFirstUser, companyController.regenerateApiKey);
    companyRouter.patch('/api-key/status', requireFirstUser, companyController.toggleApiKeyStatus);

    companyRouter.get('/', companyController.getCompanies);
    companyRouter.get('/:id', validateParamId, companyController.getCompany);
    companyRouter.post('/', companyValidator, validate, companyController.create);
    companyRouter.put('/:id', validateParamId, companyValidator, validate, companyController.updateCompany);
    companyRouter.patch('/:id', validateParamId, companyController.updateImageCompany);
    companyRouter.delete('/:id', validateParamId, companyController.removeCompany);
    router.use('/companies', companyRouter);
}
