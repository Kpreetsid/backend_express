import { NextFunction, Request, Response } from 'express';
import { usersService } from '../../masters/user/user.service';
import { verificationService } from './verification.service';

class VerificationController {

    async sendVerificationCode (req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { email } = req.body;
            if (!email) {
                throw Object.assign(new Error('Email is required'), { status: 400 });
            }
            const identifier = String(email).trim();
            const emailCheck: any = await usersService.getAllUsers({
                $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
                user_status: 'active'
            });
            if(emailCheck.length === 0) {
                throw Object.assign(new Error('Email not found'), { status: 404 });
            }
            const match = { email: emailCheck[0].email, firstName: emailCheck[0].firstName, lastName: emailCheck[0].lastName };
            const data = await verificationService.sendVerificationEmailCode(match);
            if (!data) {
                throw Object.assign(new Error('Failed to send verification email'), { status: 500 });
            }
            res.status(200).json({ status: true, message: "Verification email sent successfully" });
        } catch (error) {
            next(error);
        }
    };
    
    async userOTPVerification (req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { email, verificationCode } = req.body;
            if (!email || !verificationCode) {
                throw Object.assign(new Error('Email and OTP are required'), { status: 400 });
            }
            if (verificationCode.toString().length !== 6) {
                throw Object.assign(new Error('invalid OTP (One Time Password)'), { status: 400 });
            }
            const identifier = String(email).trim();
            const emailCheck: any = await usersService.getAllUsers({
                $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
                user_status: 'active'
            });
            if (emailCheck.length === 0) {
                throw Object.assign(new Error('Email not found'), { status: 404 });
            }
            const data = await verificationService.consumeUserOTP(emailCheck[0].email, String(verificationCode));
            if (!data) {
                throw Object.assign(new Error('Invalid or expired verification code'), { status: 400 });
            }
            const user = await usersService.userVerified(String(emailCheck[0]._id));
            if (!user) {
                throw Object.assign(new Error('Failed to verify user'), { status: 500 });
            }
            res.status(200).json({ status: true, message: "User verified successfully" });
        } catch (error) {
            next(error);
        }
    };
}

export const verificationController = new VerificationController();
