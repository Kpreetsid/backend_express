import express from 'express';
import { sendVerificationEmail, userOTPVerification } from './resetPassword.controller';
import { changeUserPassword } from '../../masters/user/user.controller';

export default (router: express.Router) => {
    const resetPasswordRouter = express.Router();
    resetPasswordRouter.post('/send-verification-email', sendVerificationEmail);
    resetPasswordRouter.post('/verify-otp', userOTPVerification);
    resetPasswordRouter.post('/change-password', changeUserPassword);
    router.use('/reset-password', resetPasswordRouter);
}