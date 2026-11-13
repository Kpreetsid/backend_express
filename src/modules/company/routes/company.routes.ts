import express from 'express';
import { companyController } from '../controllers/company.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { companyValidator } from '../validators/company.validator';
import { validate } from '../../../common/middlewares/validator.middleware';
import { requireFirstUser } from '../../../common/middlewares/firstUser.middleware';
import { getTwoStepSettings, updateTwoStepSettings } from '../services/two-step-settings.controller';
import { companyProfileController } from '../controllers/company-profile.controller';

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
