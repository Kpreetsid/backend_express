import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAll, getDataById, insert, updateById, removeById, getLocationWiseUser } from './user.service';
import { IUser } from '../../models/user.model';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getAll(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getDataById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getLocationWiseUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getLocationWiseUser(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await insert(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await updateById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await removeById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}