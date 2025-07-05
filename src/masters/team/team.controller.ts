import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAll, getDataById, insert, updateById, removeById } from './team.service';
import { IUser } from '../../models/user.model';

export const getAllTeams = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        await getAll(req, res, next);
    } catch (error: any) {
        next(error);
    }
}

export const getTeamsByID = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        await getDataById(req, res, next);
    } catch (error: any) {
        next(error);
    }
}

export const createTeams = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        await insert(req, res, next);
    } catch (error: any) {
        next(error);
    }
}

export const updateTeams = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        await updateById(req, res, next);
    } catch (error: any) {
        next(error);
    }
}

export const removeTeams = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        await removeById(req, res, next);
    } catch (error: any) {
        next(error);
    }
}
