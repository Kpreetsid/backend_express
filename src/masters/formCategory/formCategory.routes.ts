import express from 'express';
import { formCategoryController } from "./formCategory.controller";
import { validateParamId } from '../../middlewares/validate';
import { categoryValidator } from './formCategory.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', hasRolePermission('form_category', 'view'), formCategoryController.getAllFormCategories);
    formCategoryRouter.get('/:id', validateParamId, hasRolePermission('form_category', 'view'), formCategoryController.getFormCategoryByID);
    formCategoryRouter.post('/', hasRolePermission('form_category', 'add'), categoryValidator, validate, formCategoryController.create);
    formCategoryRouter.put('/:id', validateParamId, hasRolePermission('form_category', 'edit'), categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.patch('/:id', validateParamId, hasRolePermission('form_category', 'edit'), categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.delete('/:id', validateParamId, hasRolePermission('form_category', 'delete'), formCategoryController.remove);
    router.use('/form-categories', formCategoryRouter);
}
