import express, { NextFunction, Request, Response } from 'express';
import { emailVerificationCode, verifyOTPCode } from './registration.service';

export const userRegister = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        await emailVerificationCode(req, res, next);
    } catch (error) {
        console.error(error);
        next(error);
    }
}

export const sendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    await emailVerificationCode(req, res, next);
}

export const userOTPVerification = async (req: Request, res: Response, next: NextFunction) => {
    await verifyOTPCode(req, res, next);
}