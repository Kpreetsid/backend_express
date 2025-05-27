import express from 'express';
import { getRoles, getRole, createRole, updateRole, removeRole } from './roles.controller';

export default (router: express.Router) => {
    const roleRouter = express.Router();
    roleRouter.get('/', getRoles);
    roleRouter.get('/:id', getRole);
    roleRouter.post('/', createRole);
    roleRouter.put('/:id', updateRole);
    roleRouter.delete('/:id', removeRole);
    router.use('/roles', roleRouter);
}