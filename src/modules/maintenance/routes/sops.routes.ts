import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { sopsController } from '@modules/maintenance/controllers/sops.controller';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { sopsValidator } from '@modules/maintenance/validators/sops.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.use(hasRolePermission('form', 'view'));
    sopRouter.get('/', sopsController.getAll);
    sopRouter.get('/:id', validateParamId, sopsController.getSop);
    sopRouter.post('/', hasRolePermission('form', 'add'), sopsValidator, validate, sopsController.create);
    sopRouter.put('/:id', validateParamId, hasRolePermission('form', 'edit'), sopsValidator, validate, sopsController.update);
    sopRouter.patch('/:id', validateParamId, hasRolePermission('form', 'edit'), sopsValidator, validate, sopsController.update);
    sopRouter.delete('/:id', validateParamId, hasRolePermission('form', 'delete'), sopsController.remove);
    router.use('/sops', sopRouter);
}

