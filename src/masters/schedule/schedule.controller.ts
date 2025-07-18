import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './schedule.service';

export const getSchedules = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getAll(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getDataById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const createSchedule = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await insert(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const updateSchedule = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const removeSchedule = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await removeById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}