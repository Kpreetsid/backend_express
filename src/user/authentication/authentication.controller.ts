import express, { Request, Response, NextFunction } from 'express';
import { userAuthentication, userLogOutService } from './authentication.service';

export const authentication = async (req: Request, res: Response, next: NextFunction) => {
    await userAuthentication(req, res, next);
}

export const userLogOut = async (req: Request, res: Response, next: NextFunction) => {
    await userLogOutService(req, res, next);
};