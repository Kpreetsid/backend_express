import express from 'express';
import { getCompanies, getCompany, create, updateCompany, removeCompany, updateImageCompany } from './company.controller';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', getCompanies);
    companyRouter.get('/:id', getCompany);
    companyRouter.post('/', create);
    companyRouter.put('/:id', updateCompany);
    companyRouter.patch('/:id', updateImageCompany);
    companyRouter.delete('/:id', removeCompany);
    router.use('/companies', companyRouter);
}