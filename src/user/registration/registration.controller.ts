import express, { NextFunction, Request, Response } from 'express';
import { insert } from './registration.service';

export const userRegister = async (req: Request, res: Response, next: NextFunction) => {
    await insert(req, res, next);
}