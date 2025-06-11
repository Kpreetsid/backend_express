import express from 'express';
import { getCompanies, getCompany, getCompaniesByParam, updateCompany, removeCompany } from './company.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', getCompanies);
    companyRouter.get('/filter', getCompaniesByParam);
    companyRouter.get('/:id', getCompany);
    companyRouter.put('/:id', updateCompany);
    companyRouter.delete('/:id', hasPermission('admin'), removeCompany);
    router.use('/companies', companyRouter);
}