import { PostModel, IPost } from "../../models/post.model";
import { Request, Response, NextFunction } from 'express';

export const getAllParts = async (match: any): Promise<IPost[]> => {
  match.visible = true;
  return await PostModel.find(match).sort({ _id: -1 });
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newPost = new PostModel(req.body);
    const data = await newPost.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (id: any, body: any, user_id: any): Promise<any> => {
  await PostModel.findByIdAndUpdate(id, body, { new: true });
};

export const removeById = async (id: any, user_id: any): Promise<any> => {
  return await PostModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};