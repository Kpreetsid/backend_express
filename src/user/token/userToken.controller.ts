import express, { Request, Response, NextFunction } from 'express';
import { getAllUserTokens } from './userToken.service';

export const getUserByToken = async (req: Request, res: Response, next: NextFunction) => {
  await getAllUserTokens(req, res, next);
};