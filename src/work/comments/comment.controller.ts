import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './comment.service';

export const getComments = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAll(req, res, next);
}

export const getComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getDataById(req, res, next);
}

export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await insert(req, res, next);
}

export const updateComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await updateById(req, res, next);
}

export const removeComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await removeById(req, res, next);
}