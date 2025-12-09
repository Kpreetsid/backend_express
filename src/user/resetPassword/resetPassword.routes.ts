import express from 'express';
import { resetPasswordController } from './resetPassword.controller';
import { userController } from '../../masters/user/user.controller';

export default (router: express.Router) => {
    const resetPasswordRouter = express.Router();
    resetPasswordRouter.post('/send-verification-email', resetPasswordController.sendVerificationEmail);
    resetPasswordRouter.post('/verify-otp', resetPasswordController.userOTPVerification);
    resetPasswordRouter.post('/change-password', userController.changeUserPassword);
    router.use('/reset-password', resetPasswordRouter);
}