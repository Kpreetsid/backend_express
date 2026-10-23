import express from 'express';
import { sopsController } from '../controllers/sops.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { sopsValidator } from '../validators/sops.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

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

