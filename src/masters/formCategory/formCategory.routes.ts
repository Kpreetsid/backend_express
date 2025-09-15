import express from 'express';
import { updateFormCategory, removeFormCategory, getAllFormCategories, getFormCategoryByID, create } from './formCategory.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', getAllFormCategories);
    formCategoryRouter.get('/:id', getFormCategoryByID);
    formCategoryRouter.post('/', create);
    formCategoryRouter.put('/:id', updateFormCategory);
    formCategoryRouter.delete('/:id', hasPermission('admin'),removeFormCategory);
    router.use('/form-categories', formCategoryRouter);
}