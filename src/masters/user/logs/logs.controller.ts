import { Request, Response, NextFunction } from 'express';
import { getAllUserLogs } from './logs.service';
import { get } from 'lodash';
import { IUser } from '../../../models/user.model';

export const userLogs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        await getAllUserLogs(req, res, next);
    } catch (error) {
        next(error);
    }
}