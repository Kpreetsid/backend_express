import { NextFunction, Request, Response } from 'express';
import { usersService } from '../../masters/user/user.service';
import { resetPasswordService } from './resetPassword.service';

class ResetPasswordController {

    async sendVerificationEmail (req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { email } = req.body;
            if (!email) {
                throw Object.assign(new Error('Email is required'), { status: 400 });
            }
            const emailCheck: any = await usersService.getAllUsers({ email: email });
            if(emailCheck.length === 0) {
                throw Object.assign(new Error('User not registered. Please register first.'), { status: 404 });
            }
            if(emailCheck[0].user_status !== 'active') {
                throw Object.assign(new Error('User is not active, Please contact admin.'), { status: 404 });
            }
            const match = { email: req.body.email, firstName: emailCheck[0].firstName, lastName: emailCheck[0].lastName };
            const data = await resetPasswordService.sendVerificationEmailCode(match);
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
            const emailCheck: any = await usersService.getAllUsers({ email });
            if (emailCheck.length === 0) {
                throw Object.assign(new Error('User not registered. Please register first.'), { status: 404 });
            }
            if (emailCheck[0].user_status !== 'active') {
                throw Object.assign(new Error('User is not active, Please contact admin.'), { status: 404 });
            }
            const match: any = { email: emailCheck[0].email };
            const otpExists = await resetPasswordService.verifyOTPExists(match);
            if (!otpExists) {
                throw Object.assign(new Error('OTP has expired. Please request a new one.'), { status: 410 });
            }
            match.code = verificationCode;
            const data = await resetPasswordService.verifyUserOTP(match);
            if (!data) {
                throw Object.assign(new Error('invalid OTP (One Time Password)'), { status: 400 });
            }
            res.status(200).json({ status: true, message: "User OTP verified successfully" });
        } catch (error) {
            next(error);
        }
    };
}

export const resetPasswordController = new ResetPasswordController();