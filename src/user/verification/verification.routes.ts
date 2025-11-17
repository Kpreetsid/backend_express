import express from 'express';
import { sendVerificationCode, userOTPVerification } from './verification.controller';

export default (router: express.Router) => {
    const userVerificationRouter = express.Router();
    userVerificationRouter.post('/send-verification-code', sendVerificationCode);
    userVerificationRouter.post('/verify-user', userOTPVerification);
    router.use('/user', userVerificationRouter);
}