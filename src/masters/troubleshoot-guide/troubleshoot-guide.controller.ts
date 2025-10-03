import { Request, Response, NextFunction } from 'express';
import { getAllTroubleshootGuide, getTroubleshootGuideById, insertTroubleshootGuide, updateTroubleshootGuideById, removeTroubleshootGuideById } from './troubleshoot-guide.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getAllData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        await getAllTroubleshootGuide(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const getDataByID = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        await getTroubleshootGuideById(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const createData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        await insertTroubleshootGuide(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const updateData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        await updateTroubleshootGuideById(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const removeData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        await removeTroubleshootGuideById(req, res, next);
    } catch (error) {
        next(error);
    }
}
