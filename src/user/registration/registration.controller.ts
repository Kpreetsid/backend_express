import express, { NextFunction, Request, Response } from 'express';
import { emailVerificationCode, verifyOTPCode } from './registration.service';
import { getAllUsers } from '../../masters/user/user.service';

export const userRegister = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, username, firstName, lastName } = req.body;
        if (!email || !username || !firstName || !lastName) {
            throw Object.assign(new Error('Email and Username are required'), { status: 400 });
        }
        const isEmailExists = await getAllUsers({ email: email });
        if (isEmailExists.length > 0) {
            throw Object.assign(new Error('Email already exists'), { status: 403 });
        }
        const isUserNameExists = await getAllUsers({ username: username });
        if (isUserNameExists.length > 0) {
            throw Object.assign(new Error('Username already exists'), { status: 403 });
        }
        const match = { email: email, firstName: firstName, lastName: lastName };
        const data = await emailVerificationCode(match);
        if(!data) {
            throw Object.assign(new Error('Failed to send verification email'), { status: 500 });
        }
        res.status(200).json({ status: true, message: "Verification email sent successfully" });
    } catch (error: any) {
        next(error);
    }
}

export const userOTPVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        const data = await verifyOTPCode(body);
        if (!data) {
            throw Object.assign(new Error('OTP verification failed'), { status: 403 });
        }
        res.status(201).json({ status: true, message: "OTP code verified successfully" });
    } catch (error: any) {
        next(error);
    }
}