import express from 'express';
import { authentication, externalToken, authenticationByToken, resetPassword, userLogOut } from '../authentication/authentication.controller'; 
import { isAuthenticated } from '../../_config/auth';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', authentication);
    userRouter.get('/create_external_token/:email', externalToken);
    userRouter.post('/external_auth', authenticationByToken);
    userRouter.post('/updatePassword', resetPassword);
    userRouter.get('/logout', isAuthenticated, userLogOut);
    router.use('/users', userRouter);
}