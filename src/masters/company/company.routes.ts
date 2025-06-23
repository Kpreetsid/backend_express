import express from 'express';
import { getCompanies, getCompany, create, updateCompany, removeCompany } from './company.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', getCompanies);
    companyRouter.get('/:id', getCompany);
    companyRouter.post('/', create);
    companyRouter.put('/:id', updateCompany);
    companyRouter.delete('/:id', hasPermission('admin'), removeCompany);
    router.use('/companies', companyRouter);
}