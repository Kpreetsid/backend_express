import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAllParts, insert, updateById, removeById } from './posts.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getPosts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    // const match: any = { account_id: account_id };
    const match: any = { account_id, visible: true };

    const { postType, relatedTo } = req.query;
    if (postType) {
      match.postType = postType.toString().split(',');
    }
    if (relatedTo) {
      match.relatedTo = relatedTo.toString().split(',');
    }
    if (userRole !== 'admin') {
      match.userId = user_id;
    }
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getPost = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    const { postType, relatedTo } = req.query;
    if (postType) {
      match.postType = postType.toString().split(',');
    }
    if (relatedTo) {
      match.relatedTo = relatedTo.toString().split(',');
    }
    if (userRole !== 'admin') {
      match.userId = user_id;
    }
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createPost = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await insert(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updatePost = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    body.updatedBy = user_id;
    console.log({ id, body });
    await updateById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const removePost = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeById(req, res, next);
  } catch (error) {
    next(error);
  }
}