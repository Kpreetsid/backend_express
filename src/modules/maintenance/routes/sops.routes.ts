import express from 'express';
import { sopsController } from '../controllers/sops.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';

import { sopsValidator, updateSopsValidator } from '../validators/sops.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

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

