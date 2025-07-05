import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAll, getDataById, insert, updateById, removeById } from './posts.service';
import { IUser } from '../../models/user.model';

export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getAll(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getDataById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await insert(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await updateById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const removePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await removeById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}