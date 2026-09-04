import express from 'express';
import { resetPasswordController } from '../controllers/resetPassword.controller';
import { userController } from '../../users/controllers/user.controller';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';

export default (router: express.Router) => {
    const resetPasswordRouter = express.Router();
    resetPasswordRouter.post('/send-verification-email', rateLimiter.passwordResetLimiter, resetPasswordController.sendVerificationEmail);
    resetPasswordRouter.post('/verify-otp', rateLimiter.otpValidateLimiter, resetPasswordController.userOTPVerification);
    resetPasswordRouter.post('/change-password', rateLimiter.passwordResetValidateLimiter, userController.changeUserPassword);
    router.use('/reset-password', resetPasswordRouter);
}