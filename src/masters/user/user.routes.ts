import express from 'express';
import { getUsers, getUser, createUser, updateUser, removeUser, getLocationWiseUsers } from './user.controller';

export default (router: express.Router) => {
    router.get('/users', getUsers);
    router.get('/user/:id', getUser);
    router.get('/users/location/:id', getLocationWiseUsers);
    router.post('/user', createUser);
    router.put('/user/:id', updateUser);
    router.delete('/user/:id', removeUser);
}