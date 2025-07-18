import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './team.service';

export const getAllTeams = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await getAll(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const getTeamsByID = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await getDataById(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const createTeams = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await insert(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const updateTeams = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await updateById(req, res, next);
    } catch (error) {
        next(error);
    }
}

export const removeTeams = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await removeById(req, res, next);
    } catch (error) {
        next(error);
    }
}
