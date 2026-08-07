import express from 'express';
import { rolesController } from './roles.controller';
import { validateParamId } from '../../../middlewares/validate';
import { rolesValidator } from './roles.validator';
import { validate } from '../../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', validateParamId, rolesController.getDataById);
    roleRouter.post('/', rolesValidator, validate, rolesController.createRole);
    roleRouter.put('/:id', validateParamId, rolesValidator, rolesController.updateRole);
    roleRouter.patch('/:id', validateParamId, rolesValidator, rolesController.updateRole);
    roleRouter.delete('/:id', validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}
