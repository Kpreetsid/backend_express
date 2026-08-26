import express from 'express';
import { rolesController } from './roles.controller';
import { validateParamId } from '../../../middlewares/validate';
import { createRoleValidator, updateRoleValidator } from './roles.validator';
import { validate } from '../../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', validateParamId, rolesController.getDataById);
    roleRouter.post('/', createRoleValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.patch('/:id', validateParamId, updateRoleValidator, validate, rolesController.updateRole);
    roleRouter.delete('/:id', validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}

