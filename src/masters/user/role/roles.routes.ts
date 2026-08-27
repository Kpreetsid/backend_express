import express from 'express';
import { rolesController } from './roles.controller';
import { validateParamId } from '../../../middlewares/validate';
<<<<<<< Updated upstream
import { createRoleValidator, updateRoleValidator } from './roles.validator';
=======
import { rolePermissionUpdateValidator, rolesValidator } from './roles.validator';
>>>>>>> Stashed changes
import { validate } from '../../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', validateParamId, rolesController.getDataById);
<<<<<<< Updated upstream
    roleRouter.post('/', createRoleValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', validateParamId, updateRoleValidator, validate, rolesController.updateRole);
=======
    roleRouter.post('/', rolesValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', validateParamId, rolePermissionUpdateValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', validateParamId, rolePermissionUpdateValidator, validate, rolesController.updateRole);
>>>>>>> Stashed changes
    roleRouter.delete('/:id', validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}

