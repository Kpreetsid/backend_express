import express from 'express';
import { getRoles, getRole, createRole, updateRole, removeRole } from './roles.controller';

export default (router: express.Router) => {
    router.get('/users/roles', getRoles);
    router.get('/users/role/:id', getRole);
    router.post('/users/role', createRole);
    router.put('/users/role/:id', updateRole);
    router.delete('/users/role/:id', removeRole);
}