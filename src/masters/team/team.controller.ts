import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './team.service';

export const getAllTeams = async (req: Request, res: Response, next: NextFunction) => {
    await getAll(req, res, next);
}

export const getTeamsByID = async (req: Request, res: Response, next: NextFunction) => {
    await getDataById(req, res, next);
}

export const createTeams = async (req: Request, res: Response, next: NextFunction) => {
    await insert(req, res, next);
}

export const updateTeams = async (req: Request, res: Response, next: NextFunction) => {
    await updateById(req, res, next);
}

export const removeTeams = async (req: Request, res: Response, next: NextFunction) => {
    await removeById(req, res, next);
}
