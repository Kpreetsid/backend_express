import express from 'express';
import { registrationController } from '../controllers/registration.controller';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';

export default (router: express.Router) => {
    const registrationRouter = express.Router();
    registrationRouter.post('/', rateLimiter.otpLimiter, registrationController.userRegister);
    registrationRouter.post('/sendEmail', rateLimiter.otpLimiter, registrationController.userRegister);
    registrationRouter.post('/verifyOTP', rateLimiter.otpValidateLimiter, registrationController.userOTPVerification);
    router.use('/registration', registrationRouter);
}