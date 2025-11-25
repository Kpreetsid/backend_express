import { Request, Response, NextFunction } from 'express';
import { getAllUserLogs } from './logs.service';
import { get } from 'lodash';
import { IUser } from '../../../models/user.model';

export const userLogs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        const match: any = { account_id };
        if (userRole !== 'admin') {
            match.userId = user_id
        }
        const data = await getAllUserLogs(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
}