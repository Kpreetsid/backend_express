import express from 'express';
import { getAll, getDataById, createRole, updateRole, removeRole, myRoleData } from './roles.controller';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', getAll);
    roleRouter.get('/self', myRoleData);
    roleRouter.get('/:id', getDataById);
    roleRouter.post('/', createRole);
    roleRouter.put('/:id', updateRole);
    roleRouter.delete('/:id', removeRole);
    router.use('/roles', roleRouter);
}