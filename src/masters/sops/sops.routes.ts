import express from 'express';
import { sopsController } from './sops.controller';
import { validateParamId } from '../../middlewares/validate';
<<<<<<< Updated upstream
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

=======
import { sopsValidator, updateSopsValidator } from './sops.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares/permission';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', hasRolePermission('form', 'view'), sopsController.getAll);
    sopRouter.get('/:id', validateParamId, hasRolePermission('form', 'view'), sopsController.getSop);
    sopRouter.post('/', hasRolePermission('form', 'add'), sopsValidator, validate, sopsController.create);
    sopRouter.put('/:id', validateParamId, hasRolePermission('form', 'edit'), sopsValidator, validate, sopsController.update);
    sopRouter.patch('/:id', validateParamId, hasRolePermission('form', 'edit'), updateSopsValidator, validate, sopsController.update);
    sopRouter.delete('/:id', validateParamId, hasRolePermission('form', 'delete'), sopsController.remove);
    router.use('/sops', sopRouter);
}
>>>>>>> Stashed changes
