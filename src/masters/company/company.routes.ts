import express from 'express';
import { companyController } from './company.controller';
import { validateParamId } from '../../middlewares/validate';
import { companyValidator } from './company.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', companyController.getCompanies);
    companyRouter.get('/subscription-limits', companyController.getSubscriptionLimits);
    companyRouter.get('/:id', validateParamId, companyController.getCompany);
    companyRouter.post('/', companyValidator, validate, companyController.create);
    companyRouter.put('/:id', validateParamId, companyValidator, validate, companyController.updateCompany);
    companyRouter.patch('/:id', validateParamId, companyController.updateImageCompany);
    companyRouter.delete('/:id', validateParamId, companyController.removeCompany);
    router.use('/companies', companyRouter);
}
