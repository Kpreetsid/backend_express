import express, { NextFunction, Request, Response } from 'express';
import { insert, emailVerificationCode, verifyOTPCode } from './registration.service';

export const userRegister = async (req: Request, res: Response, next: NextFunction) => {
    await insert(req, res, next);
}

export const sendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    await emailVerificationCode(req, res, next);
}

export const userOTPVerification = async (req: Request, res: Response, next: NextFunction) => {
    await verifyOTPCode(req, res, next);
}