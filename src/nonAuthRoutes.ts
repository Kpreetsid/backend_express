import express from 'express';
const router = express.Router();
import userAuth from './user/authentication/authentication.routes';
import userRegister from './user/registration/registration.routes';
import userTokenRoutes from './user/token/userToken.routes';
import userResetPassword from './user/resetPassword/resetPassword.routes';

export default (): express.Router => {
    userRegister(router);
    userAuth(router);
    userTokenRoutes(router);
    userResetPassword(router);
    return router;
}