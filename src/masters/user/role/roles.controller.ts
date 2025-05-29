import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById, getMyRoles } from './roles.service';

export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const myRoleData = async (req: Request, res: Response, next: NextFunction) => {
  await getMyRoles(req, res, next);
}

export const getRole = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeRole = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}