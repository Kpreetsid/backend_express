import { NextFunction, Request, Response } from 'express';
import { registrationService } from './registration.service';
import { usersService } from '../../masters/user/user.service';
import { companyService } from '../../masters/company/company.service';
import { assertStrongPassword } from '../../utils/passwordPolicy';

class RegistrationController {
    async userRegister (req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { email, username, firstName, account_name, password } = req.body;
            if (!email || !username || !firstName || !account_name || !password) {
                throw Object.assign(new Error('Email, username, first name, account name and password are required'), { status: 400 });
            }
            assertStrongPassword(password);
            const normalizedEmail = String(email).trim().toLowerCase();
            const normalizedUsername = String(username).trim().toLowerCase();
            req.body.email = normalizedEmail;
            req.body.username = normalizedUsername;
            const isEmailExists: any = await usersService.getAllUsers({ email: normalizedEmail });
            if (isEmailExists.length > 0) {
                throw Object.assign(new Error('Email already exists'), { status: 403 });
            }
            const isUserNameExists: any = await usersService.getAllUsers({ username: normalizedUsername });
            if (isUserNameExists.length > 0) {
                throw Object.assign(new Error('Username already exists'), { status: 403 });
            }
            const isAccountExists = await companyService.getAllCompanies({ account_name: account_name });
            if (isAccountExists.length > 0) {
                throw Object.assign(new Error('Account already exists'), { status: 403 });
            }
            const match = { email: normalizedEmail, firstName: firstName };
            const data = await registrationService.emailVerificationCode(match);
            if(!data) {
                throw Object.assign(new Error('Failed to send verification email'), { status: 500 });
            }
            res.status(200).json({ status: true, message: "Verification email sent successfully" });
        } catch (error) {
            next(error);
        }
    }

    async userOTPVerification (req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const body = req.body;
            if (!body.email || !body.verificationCode) {
                throw Object.assign(new Error('Email and OTP are required'), { status: 400 });
            }
            if (body.verificationCode.toString().length !== 6) {
                throw Object.assign(new Error('Invalid OTP (One Time Password)'), { status: 400 });
            }
            assertStrongPassword(body.password);
            const data = await registrationService.verifyOTPCode(body);
            if (!data) {
                throw Object.assign(new Error('OTP verification failed'), { status: 403 });
            }
            res.status(201).json({ status: true, message: "OTP code verified successfully" });
        } catch (error) {
            next(error);
        }
    }
}

export const registrationController = new RegistrationController();
