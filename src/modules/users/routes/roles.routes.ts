import express from 'express';
import { rolesController } from '../controllers/roles.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { createRoleValidator, updateRoleValidator } from '../validators/roles.validator';
import { validate } from '../../../common/middlewares/validator.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', hasRolePermission('permission', 'view'), rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', hasRolePermission('permission', 'view'), validateParamId, rolesController.getDataById);
    roleRouter.post('/', hasRolePermission('permission', 'add'), createRoleValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', hasRolePermission('permission', 'edit'), validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', hasRolePermission('permission', 'edit'), validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.delete('/:id', hasRolePermission('permission', 'delete'), validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}

