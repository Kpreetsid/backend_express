import express from 'express';
import { formCategoryController } from "../controllers/formCategory.controller";
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { categoryValidator, updateCategoryValidator } from '../validators/formCategory.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', hasRolePermission('form_category', 'view'), formCategoryController.getAllFormCategories);
    formCategoryRouter.get('/:id', validateParamId, hasRolePermission('form_category', 'view'), formCategoryController.getFormCategoryByID);
    formCategoryRouter.post('/', hasRolePermission('form_category', 'add'), categoryValidator, validate, formCategoryController.create);
    formCategoryRouter.put('/:id', validateParamId, hasRolePermission('form_category', 'edit'), categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.patch('/:id', validateParamId, hasRolePermission('form_category', 'edit'), updateCategoryValidator, validate, formCategoryController.update);
    formCategoryRouter.delete('/:id', validateParamId, hasRolePermission('form_category', 'delete'), formCategoryController.remove);
    router.use('/form-categories', formCategoryRouter);
}
