import express from 'express';
import { formCategoryController } from "./formCategory.controller";
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', formCategoryController.getAllFormCategories);
    formCategoryRouter.get('/:id', validateParamId, formCategoryController.getFormCategoryByID);
    formCategoryRouter.post('/', formCategoryController.create);
    formCategoryRouter.put('/:id', validateParamId, formCategoryController.update);
    formCategoryRouter.patch('/:id', validateParamId, formCategoryController.update);
    formCategoryRouter.delete('/:id', validateParamId, formCategoryController.remove);
    router.use('/form-categories', formCategoryRouter);
}