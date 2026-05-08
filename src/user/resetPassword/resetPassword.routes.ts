import express from 'express';
import { resetPasswordController } from './resetPassword.controller';
import { userController } from '../../masters/user/user.controller';
import { rateLimiter } from '../../middlewares/rateLimits';

export default (router: express.Router) => {
    const resetPasswordRouter = express.Router();
    resetPasswordRouter.post('/send-verification-email', rateLimiter.passwordResetLimiter, resetPasswordController.sendVerificationEmail);
    resetPasswordRouter.post('/verify-otp', rateLimiter.otpValidateLimiter, resetPasswordController.userOTPVerification);
    resetPasswordRouter.post('/change-password', rateLimiter.passwordResetValidateLimiter, userController.changeUserPassword);
    router.use('/reset-password', resetPasswordRouter);
}