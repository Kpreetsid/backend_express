import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './sops.service';

export const getSops = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getAll(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getSop = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getDataById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const createSop = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await insert(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const updateSop = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const removeSop = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await removeById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}