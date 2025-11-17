import { Request, Response, NextFunction } from 'express';
import { userAuthentication, userAuthenticationByToken, userLogOutService, userResetPassword } from './authentication.service';

export const authentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userAuthentication(req, res, next);
}

export const authenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userAuthenticationByToken(req, res, next);
}

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userResetPassword(req, res, next);
}

export const userLogOut = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userLogOutService(req, res, next);
};