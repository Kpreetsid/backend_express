import express from 'express';
import { rolesController } from './roles.controller';
import { validateParamId } from '../../../middlewares/validate';
import { createRoleValidator, updateRoleValidator } from './roles.validator';
import { validate } from '../../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../../middlewares/permission';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', hasAccountFeature('permission'), rolesController.getAll);
    roleRouter.get('/self', hasAccountFeature('permission'), rolesController.myRoleData);
    roleRouter.get('/:id', hasAccountFeature('permission'), validateParamId, rolesController.getDataById);
    roleRouter.post('/', hasAccountFeature('permission', 'add'), createRoleValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', hasAccountFeature('permission', 'edit'), validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', hasAccountFeature('permission', 'edit'), validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.delete('/:id', hasAccountFeature('permission', 'delete'), validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}
