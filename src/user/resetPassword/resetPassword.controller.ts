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
            const normalizedEmail = String(email).trim().toLowerCase();
            const emailCheck: any = await usersService.getAllUsers({ email: normalizedEmail, user_status: 'active' });
            if (emailCheck.length) {
                const match = {
                    email: normalizedEmail,
                    firstName: emailCheck[0].firstName,
                    lastName: emailCheck[0].lastName
                };
                try {
                    await resetPasswordService.sendVerificationEmailCode(match);
                } catch (error) {
                    console.error('Password reset email delivery failed', error);
                }
            }
            res.status(200).json({
                status: true,
                message: 'If an active account exists for this email, a verification code has been sent.'
            });
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
            const normalizedEmail = String(email).trim().toLowerCase();
            const emailCheck: any = await usersService.getAllUsers({ email: normalizedEmail, user_status: 'active' });
            const resetToken = emailCheck.length
                ? await resetPasswordService.createResetProof(normalizedEmail, String(verificationCode))
                : null;
            if (!resetToken) {
                throw Object.assign(new Error('Invalid or expired verification code'), { status: 400 });
            }
            res.status(200).json({
                status: true,
                message: "User OTP verified successfully",
                data: { resetToken }
            });
        } catch (error) {
            next(error);
        }
    };
}

export const resetPasswordController = new ResetPasswordController();
