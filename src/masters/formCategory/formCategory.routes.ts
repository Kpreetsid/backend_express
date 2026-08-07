import express from 'express';
import { formCategoryController } from "./formCategory.controller";
import { validateParamId } from '../../middlewares/validate';
import { categoryValidator } from './formCategory.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', formCategoryController.getAllFormCategories);
    formCategoryRouter.get('/:id', validateParamId, formCategoryController.getFormCategoryByID);
    formCategoryRouter.post('/', categoryValidator, validate, formCategoryController.create);
    formCategoryRouter.put('/:id', validateParamId, categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.patch('/:id', validateParamId, categoryValidator, validate, formCategoryController.update);
    formCategoryRouter.delete('/:id', validateParamId, formCategoryController.remove);
    router.use('/form-categories', formCategoryRouter);
}