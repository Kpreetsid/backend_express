import { Request, Response, NextFunction } from 'express';
import { getAllUserLogs } from './logs.service';

export const userLogs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await getAllUserLogs(req, res, next);
    } catch (error: any) {
        next(error);
    }
}