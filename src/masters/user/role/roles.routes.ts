import express from 'express';
import { getRoles, getRole, createRole, updateRole, removeRole, myRoleData } from './roles.controller';
import { hasPermission } from '../../../_config/permission';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', getRoles);
    roleRouter.get('/self', myRoleData);
    roleRouter.get('/:id', getRole);
    roleRouter.post('/', hasPermission('admin'), createRole);
    roleRouter.put('/:id', hasPermission('admin'), updateRole);
    roleRouter.delete('/:id', hasPermission('admin'),removeRole);
    router.use('/roles', roleRouter);
}