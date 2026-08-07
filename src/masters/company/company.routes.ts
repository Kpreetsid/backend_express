import express from 'express';
import { companyController } from './company.controller';
import { validateParamId } from '../../middlewares/validate';
import { companyValidator } from './company.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const companyRouter = express.Router();
    companyRouter.get('/', companyController.getCompanies);
    companyRouter.get('/:id', validateParamId, companyController.getCompany);
    companyRouter.post('/', hasRolePermission('users', 'add'), companyValidator, validate, companyController.create);
    companyRouter.put('/:id', validateParamId, hasRolePermission('users', 'edit'), companyValidator, validate, companyController.updateCompany);
    companyRouter.patch('/:id', validateParamId, hasRolePermission('users', 'edit'), companyController.updateImageCompany);
    companyRouter.delete('/:id', validateParamId, hasRolePermission('users', 'delete'), companyController.removeCompany);
    router.use('/companies', companyRouter);
}
