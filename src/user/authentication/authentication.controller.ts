import { Request, Response, NextFunction } from 'express';
import { createAuthenticationByToken, userAuthentication, userAuthenticationByToken, userAuthenticationToken, userLogOutService, userResetPassword, userGetMeService } from './authentication.service';
import { refreshTokenService } from './refreshToken.service';

export const authentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userAuthentication(req, res, next);
}

export const authenticationToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userAuthenticationToken(req, res, next);
}

export const externalToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await createAuthenticationByToken(req, res, next);
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

export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const data = await refreshTokenService.refreshAccessToken(req, res);
        return res.status(200).json({ status: true, message: 'Token refreshed successfully', data });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    await userGetMeService(req, res, next);
};
