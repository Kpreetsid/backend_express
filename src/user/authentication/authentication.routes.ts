import express from 'express';

import { authentication, requestResetPassword, resetPassword, userLogOut } from '../authentication/authentication.controller'; 

export default (router: express.Router) => {
    router.post('/users/login', authentication);
    router.post('/users/requestResetPassword', requestResetPassword);
    router.post('/users/updatePassword', resetPassword);
    router.get('/users/logout', userLogOut);
}