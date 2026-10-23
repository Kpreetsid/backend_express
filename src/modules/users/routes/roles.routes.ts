import express from 'express';
import { rolesController } from '../controllers/roles.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { createRoleValidator, updateRoleValidator } from '../validators/roles.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

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

