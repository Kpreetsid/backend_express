import express from 'express';
import { authentication, authenticationToken, externalToken, authenticationByToken, resetPassword, userLogOut } from '../authentication/authentication.controller'; 
import { verifyEncryptedToken } from '../../_config/auth';

export default (router: express.Router) => {
    const userRouter = express.Router();
    userRouter.post('/login', authentication);
    userRouter.post('/authenticate', authenticationToken);
    userRouter.get('/create_external_token/:email', externalToken);
    userRouter.post('/external_auth', verifyEncryptedToken, authenticationByToken);
    userRouter.post('/updatePassword', resetPassword);
    userRouter.get('/logout', userLogOut);
    router.use('/users', userRouter);
}