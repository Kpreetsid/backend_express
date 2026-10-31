import express from 'express';
import { registerEmailLoginRoutes } from './user/email-login/email-login.routes';
const router = express.Router();
import userAuth from './user/authentication/authentication.routes';
import userRegister from './user/registration/registration.routes';
import userTokenRoutes from './user/token/userToken.routes';
import userResetPassword from './user/resetPassword/resetPassword.routes';
import userVerification from './user/verification/verification.routes';

export default (): express.Router => {
    registerEmailLoginRoutes(router);
    userRegister(router);
    userAuth(router);
    userTokenRoutes(router);
    userResetPassword(router);
    userVerification(router);
    return router;
}