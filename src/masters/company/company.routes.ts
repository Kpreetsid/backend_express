import express from 'express';
import { companyController } from './company.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', companyController.getCompanies);
    companyRouter.get('/:id', validateParamId, companyController.getCompany);
    companyRouter.post('/', companyController.create);
    companyRouter.put('/:id', validateParamId, companyController.updateCompany);
    companyRouter.patch('/:id', validateParamId, companyController.updateImageCompany);
    companyRouter.delete('/:id', validateParamId, companyController.removeCompany);
    router.use('/companies', companyRouter);
}