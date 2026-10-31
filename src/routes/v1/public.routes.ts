import express from 'express';
const router = express.Router();
import userAuth from '@modules/auth/routes/authentication.routes';
import userRegister from '@modules/auth/routes/registration.routes';
import userTokenRoutes from '@modules/auth/routes/userToken.routes';
import userResetPassword from '@modules/auth/routes/resetPassword.routes';
import userVerification from '@modules/auth/routes/verification.routes';

export default (): express.Router => {
    userRegister(router);
    userAuth(router);
    userTokenRoutes(router);
    userResetPassword(router);
    userVerification(router);
    return router;
}