import { Request, Response, NextFunction } from 'express';
import { createAuthenticationByToken, userAuthentication, userAuthenticationByToken, userAuthenticationToken, userLogOutService, userResetPassword, userGetMeService } from './authentication.service';
import { refreshTokenService } from './refreshToken.service';
import { get } from 'lodash';
import { accountAccessService } from '../../_role/accountAccess.service';

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

export const authorizeFeature = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const featureKey = String(req.body?.featureKey || '').trim();
        const action = String(req.body?.action || 'view').trim();

        if (!accountAccessService.isKnownFeature(featureKey)) {
            throw Object.assign(new Error('Invalid featureKey'), { status: 400 });
        }
        if (!accountAccessService.isKnownAction(action)) {
            throw Object.assign(new Error('Invalid action'), { status: 400 });
        }

        const roleMenu = get(req, 'roleMenu', {});
        return res.status(200).json({
            status: true,
            data: {
                allowed: accountAccessService.isEffectivePermissionEnabled(roleMenu, featureKey, action),
                accountPermissionVersion: Number(get(req, 'accountPermissionVersion', 0))
            }
        });
    } catch (error) {
        next(error);
    }
};
