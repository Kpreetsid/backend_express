import express from 'express';
import { rolesController } from './roles.controller';
import { validateParamId } from '../../../middlewares/validate';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', validateParamId, rolesController.getDataById);
    roleRouter.post('/', rolesController.createRole);
    roleRouter.put('/:id', validateParamId, rolesController.updateRole);
    roleRouter.patch('/:id', validateParamId, rolesController.updateRole);
    roleRouter.delete('/:id', validateParamId, rolesController.removeRole);
    router.use('/roles', roleRouter);
}