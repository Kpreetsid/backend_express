import express from 'express';
import { formCategoryController } from "./formCategory.controller";

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', formCategoryController.getAllFormCategories);
    formCategoryRouter.get('/:id', formCategoryController.getFormCategoryByID);
    formCategoryRouter.post('/', formCategoryController.create);
    formCategoryRouter.put('/:id', formCategoryController.update);
    formCategoryRouter.patch('/:id', formCategoryController.update);
    formCategoryRouter.delete('/:id', formCategoryController.remove);
    router.use('/form-categories', formCategoryRouter);
}