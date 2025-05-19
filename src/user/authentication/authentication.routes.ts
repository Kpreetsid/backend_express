import express from 'express';

import { authentication, userLogOut } from '../authentication/authentication.controller'; 

export default (router: express.Router) => {
    router.post('/users/login', authentication);
    router.get('/users/logout', userLogOut);
}