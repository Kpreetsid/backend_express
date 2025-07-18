import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './observation.service';

export const getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getAll(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getDataById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const createObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await insert(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateById(req, res, next);    
  } catch (error) {
    next(error);
  }
}

export const removeObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await removeById(req, res, next);
  } catch (error) {
    next(error);
  }
}