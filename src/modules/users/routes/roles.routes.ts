import express from 'express';
import { rolesController } from '../controllers/roles.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';

import { rolePermissionUpdateValidator, rolesValidator } from '../validators/roles.validator';

import { validate } from '../../../common/middlewares/validate.middleware';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', validateParamId, rolesController.getDataById);

    roleRouter.post('/', rolesValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', validateParamId, rolePermissionUpdateValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', validateParamId, rolePermissionUpdateValidator, validate, rolesController.updateRole);

    roleRouter.delete('/:id', validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}

