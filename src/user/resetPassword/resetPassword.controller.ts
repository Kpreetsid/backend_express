import express, { NextFunction, Request, Response } from 'express';
import { getAllUsers } from '../../masters/user/user.service';
import { sendVerificationEmailCode, verifyOTPExists, verifyUserOTP } from './resetPassword.service';

export const sendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body.email) {
            throw Object.assign(new Error('Email is required'), { status: 400 });
        }
        const emailCheck = await getAllUsers({ email: req.body.email });
        if(emailCheck.length === 0) {
            throw Object.assign(new Error('Email not found'), { status: 404 });
        }
        const match = { email: req.body.email, firstName: emailCheck[0].firstName, lastName: emailCheck[0].lastName };
        const data = await sendVerificationEmailCode(match);
        if (!data) {
            throw Object.assign(new Error('Failed to send verification email'), { status: 500 });
        }
        res.status(200).json({ status: true, message: "Verification email sent successfully" });
    } catch (error: any) {
        next(error);
    }
};

export const userOTPVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, verificationCode } = req.body;
        if (!email || !verificationCode) {
            throw Object.assign(new Error('Email and OTP are required'), { status: 400 });
        }
        const emailCheck = await getAllUsers({ email });
        if (emailCheck.length === 0) {
            throw Object.assign(new Error('Email not found'), { status: 404 });
        }
        const match: any = { email: emailCheck[0].email, firstName: emailCheck[0].firstName, lastName: emailCheck[0].lastName };
        const otpExists = await verifyOTPExists(match);
        if (!otpExists) {
            throw Object.assign(new Error('OTP has expired'), { status: 404 });
        }
        match.code = verificationCode;
        const data = await verifyUserOTP(match);
        if (!data) {
            throw Object.assign(new Error('Invalid OTP'), { status: 400 });
        }
        res.status(200).json({ status: true, message: "User OTP verified successfully" });
    } catch (error: any) {
        next(error);
    }
};