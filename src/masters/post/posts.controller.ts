import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAllParts, getDataById, insert, updateById, removeById } from './posts.service';
import { IUser } from '../../models/user.model';

export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const { postType, relatedTo } = req.query;
    if(postType) {
      match.postType = postType.toString().split(',');
    }
    if(relatedTo) {
      match.relatedTo = relatedTo.toString().split(',');
    }
    if(userRole !== 'admin') {
      match.userId = user_id;
    }
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
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