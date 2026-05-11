import express from 'express';
import { sopsController } from './sops.controller';
import { validateParamId } from '../../middlewares/validate';
import { sopsValidator } from './sops.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', sopsController.getAll);
    sopRouter.get('/:id', validateParamId, sopsController.getSop);
    sopRouter.post('/', sopsValidator, validate, sopsController.create);
    sopRouter.put('/:id', validateParamId, sopsValidator, validate, sopsController.update);
    sopRouter.patch('/:id', validateParamId, sopsValidator, validate, sopsController.update);
    sopRouter.delete('/:id', validateParamId, sopsController.remove);
    router.use('/sops', sopRouter);
}