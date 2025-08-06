import { Post, IPost } from "../../models/post.model";
import { Request, Response, NextFunction } from 'express';

export const getAllParts = async (match: any): Promise<IPost[]> => {
  match.isActive = true;
  return await Post.find(match);
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newPost = new Post(req.body);
    const data = await newPost.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await Post.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await Post.findById(id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Post.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};