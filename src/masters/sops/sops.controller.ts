import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAll, getDataById, insert, updateById, removeById } from './sops.service';
import { IUser } from '../../models/user.model';

export const getSops = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getAll(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getSop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getDataById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const createSop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await insert(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const updateSop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await updateById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeSop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await removeById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}