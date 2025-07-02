import express from 'express';
import { sendVerificationEmail, userOTPVerification, resetPassword } from './resetPassword.controller';

export default (router: express.Router) => {
    router.post('/send-verification-email', sendVerificationEmail);
    router.post('/verify-user', userOTPVerification);
    router.post('/reset-password', resetPassword);
}