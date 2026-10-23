import express from 'express';
import { formCategoryController } from "../controllers/formCategory.controller";
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { categoryValidator } from '../validators/formCategory.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

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
