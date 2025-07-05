import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAll, getDataById, insert, updateById, removeById, getMyRoles } from './roles.service';
import { IUser } from '../../../models/user.model';

export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
     await getAll(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const myRoleData = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
     await getMyRoles(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
     await getDataById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
     await insert(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
     await updateById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const removeRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
     await removeById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}