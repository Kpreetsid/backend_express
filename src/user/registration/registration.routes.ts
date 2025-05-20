import express from 'express';

import { userRegister, sendVerificationEmail, userOTPVerification } from './registration.controller';

export default (router: express.Router) => {
    router.post('/registration', userRegister);
    router.post('/sendEmail', sendVerificationEmail);
    router.post('/verifyOTP', userOTPVerification);
}