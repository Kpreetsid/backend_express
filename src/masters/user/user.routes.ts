import express from 'express';
import { getUsers, getUser, createUser, updateUser, removeUser, getLocationWiseUsers } from './user.controller';
import { hasPermission, isOwnerOrAdmin } from '../../_config/permission';

export default (router: express.Router) => {
    router.get('/users', getUsers);
    router.get('/users/:id', getUser);
    router.get('/users/location/:id', hasPermission('admin'), getLocationWiseUsers);
    router.post('/users', isOwnerOrAdmin, createUser);
    router.put('/users/:id', isOwnerOrAdmin, updateUser);
    router.delete('/users/:id', isOwnerOrAdmin, removeUser);
}