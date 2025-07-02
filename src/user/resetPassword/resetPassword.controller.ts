import express, { NextFunction, Request, Response } from 'express';

export const sendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json({ status: true, message: "Verification email sent successfully" });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const userOTPVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json({ status: true, message: "User OTP verified successfully" });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) {
            throw Object.assign(new Error('Passwords do not match'), { status: 400 });
        }
        // Here you would typically update the user's password in the database
        res.status(200).json({ status: true, message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
