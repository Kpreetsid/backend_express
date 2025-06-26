import express from 'express';
import { updateFormCategory, removeFormCategory, getAllFormCategories, getFormCategoryByID, createFormCategory } from './formCategory.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', getAllFormCategories);
    formCategoryRouter.get('/:id', getFormCategoryByID);
    formCategoryRouter.post('/', createFormCategory);
    formCategoryRouter.put('/:id', updateFormCategory);
    formCategoryRouter.delete('/:id', hasPermission('admin'),removeFormCategory);
    router.use('/formCategories', formCategoryRouter);
}