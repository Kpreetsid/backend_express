import express from 'express';
import { formCategoryController } from "./formCategory.controller";
import { validateParamId } from '../../middlewares/validate';
import { categoryValidator } from './formCategory.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', formCategoryController.getAllFormCategories);
    formCategoryRouter.get('/:id', validateParamId, formCategoryController.getFormCategoryByID);
    formCategoryRouter.post('/', hasAccountFeature('form_category', 'add'), categoryValidator, validate, formCategoryController.create);
    formCategoryRouter.put('/:id', hasAccountFeature('form_category', 'edit'), validateParamId, categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.patch('/:id', hasAccountFeature('form_category', 'edit'), validateParamId, categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.delete('/:id', hasAccountFeature('form_category', 'delete'), validateParamId, formCategoryController.remove);
    router.use('/form-categories', formCategoryRouter);
}
