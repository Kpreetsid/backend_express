import express from 'express';
import { rolesController } from './roles.controller';
import { validateParamId } from '../../../middlewares/validate';
import { roleDataUpdateValidator, rolesValidator } from './roles.validator';
import { validate } from '../../../middlewares/validator.middleware';
import { hasRolePermission } from '../../../middlewares/permission';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', hasRolePermission('permission', 'view'), rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', hasRolePermission('permission', 'view'), validateParamId, rolesController.getDataById);
    roleRouter.post('/', hasRolePermission('permission', 'add'), rolesValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', hasRolePermission('permission', 'edit'), validateParamId, roleDataUpdateValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', hasRolePermission('permission', 'edit'), validateParamId, roleDataUpdateValidator, validate, rolesController.updateRole);
    roleRouter.delete('/:id', hasRolePermission('permission', 'delete'), validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}
