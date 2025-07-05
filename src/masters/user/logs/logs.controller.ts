import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAllUserLogs } from './logs.service';
import { IUser } from '../../../models/user.model';

export const userLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        await getAllUserLogs(req, res, next);
    } catch (error: any) {
        next(error);
    }
}