import express from 'express';
import { verificationController } from './verification.controller';

export default (router: express.Router) => {
    const userVerificationRouter = express.Router();
    userVerificationRouter.post('/send-verification-code', verificationController.sendVerificationCode);
    userVerificationRouter.post('/verify-user', verificationController.userOTPVerification);
    router.use('/user', userVerificationRouter);
}