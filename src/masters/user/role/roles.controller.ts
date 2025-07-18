import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById, getMyRoles } from './roles.service';

export const getRoles = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getAll(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const myRoleData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getMyRoles(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getDataById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await insert(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await removeById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}