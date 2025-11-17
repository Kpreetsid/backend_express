import express from 'express';
import { authentication, authenticationByToken, resetPassword, userLogOut } from '../authentication/authentication.controller'; 
import { isAuthenticated } from '../../_config/auth';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', authentication);
    userRouter.post('/login/:token', authenticationByToken);
    userRouter.post('/updatePassword', resetPassword);
    userRouter.get('/logout', isAuthenticated, userLogOut);
    router.use('/users', userRouter);
}