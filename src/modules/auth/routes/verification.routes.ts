import express from 'express';
import { verificationController } from '../controllers/verification.controller';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';

export default (router: express.Router) => {
    const userVerificationRouter = express.Router();
    userVerificationRouter.post('/send-verification-code', rateLimiter.emailLimiter, verificationController.sendVerificationCode);
    userVerificationRouter.post('/verify-user', rateLimiter.otpValidateLimiter, verificationController.userOTPVerification);
    router.use('/user', userVerificationRouter);
}