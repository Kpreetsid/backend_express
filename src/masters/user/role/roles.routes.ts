import express from 'express';
import { rolesController } from './roles.controller';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', rolesController.getAll);
    roleRouter.get('/self', rolesController.myRoleData);
    roleRouter.get('/:id', rolesController.getDataById);
    roleRouter.post('/', rolesController.createRole);
    roleRouter.put('/:id', rolesController.updateRole);
    roleRouter.patch('/:id', rolesController.updateRole);
    roleRouter.delete('/:id', rolesController.removeRole);
    router.use('/roles', roleRouter);
}