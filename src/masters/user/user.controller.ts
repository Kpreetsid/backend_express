import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById, getLocationWiseUser } from './user.service';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const getLocationWiseUsers = async (req: Request, res: Response, next: NextFunction) => {
  await getLocationWiseUser(req, res, next);
}

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeUser = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}