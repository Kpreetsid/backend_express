import express from 'express';

import { userRegister, userOTPVerification } from './registration.controller';

export default (router: express.Router) => {
    const registrationRouter = express.Router();
    registrationRouter.post('/', userRegister);
    registrationRouter.post('/sendEmail', userRegister);
    registrationRouter.post('/verifyOTP', userOTPVerification);
    router.use('/registration', registrationRouter);
}