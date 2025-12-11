import express from 'express';
import { registrationController } from './registration.controller';

export default (router: express.Router) => {
    const registrationRouter = express.Router();
    registrationRouter.post('/', registrationController.userRegister);
    registrationRouter.post('/sendEmail', registrationController.userRegister);
    registrationRouter.post('/verifyOTP', registrationController.userOTPVerification);
    router.use('/registration', registrationRouter);
}