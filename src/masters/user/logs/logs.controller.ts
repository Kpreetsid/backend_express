import express, { Request, Response, NextFunction } from 'express';
import { getAllUserLogs } from './logs.service';

export const userLogs = async (req: Request, res: Response, next: NextFunction) => {
    await getAllUserLogs(req, res, next);
}