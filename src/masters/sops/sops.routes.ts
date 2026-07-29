import express from 'express';
import { sopsController } from './sops.controller';
import { validateParamId } from '../../middlewares/validate';
import { sopsValidator } from './sops.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', sopsController.getAll);
    sopRouter.get('/:id', validateParamId, sopsController.getSop);
    sopRouter.post('/', hasAccountFeature('form', 'add'), sopsValidator, validate, sopsController.create);
    sopRouter.put('/:id', hasAccountFeature('form', 'edit'), validateParamId, sopsValidator, validate, sopsController.update);
    sopRouter.patch('/:id', hasAccountFeature('form', 'edit'), validateParamId, sopsValidator, validate, sopsController.update);
    sopRouter.delete('/:id', hasAccountFeature('form', 'delete'), validateParamId, sopsController.remove);
    router.use('/sops', sopRouter);
}
