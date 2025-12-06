import express from 'express';
import { companyController } from './company.controller';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', companyController.getCompanies);
    companyRouter.get('/:id', companyController.getCompany);
    companyRouter.post('/', companyController.create);
    companyRouter.put('/:id', companyController.updateCompany);
    companyRouter.patch('/:id', companyController.updateImageCompany);
    companyRouter.delete('/:id', companyController.removeCompany);
    router.use('/companies', companyRouter);
}