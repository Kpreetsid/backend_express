import express from 'express';
import { getFormCategories, getFormCategory, createFormCategory, updateFormCategory, removeFormCategory } from './formCategory.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const formCategoryRouter = express.Router();
    formCategoryRouter.get('/', getFormCategories);
    formCategoryRouter.get('/:id', getFormCategory);
    formCategoryRouter.post('/', createFormCategory);
    formCategoryRouter.put('/:id', updateFormCategory);
    formCategoryRouter.delete('/:id', hasPermission('admin'),removeFormCategory);
    router.use('/formCategories', formCategoryRouter);
}