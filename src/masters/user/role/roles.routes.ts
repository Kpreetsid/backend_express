import express from 'express';
import { getAll, getDataById, createRole, updateRole, removeRole, myRoleData } from './roles.controller';
import { hasPermission } from '../../../middlewares';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', getAll);
    roleRouter.get('/self', myRoleData);
    roleRouter.get('/:id', getDataById);
    roleRouter.post('/', hasPermission('admin'), createRole);
    roleRouter.put('/:id', hasPermission('admin'), updateRole);
    roleRouter.delete('/:id', hasPermission('admin'),removeRole);
    router.use('/roles', roleRouter);
}