import { CommentsModel, IComments } from "../../models/comment.model";
import { Request, Response, NextFunction } from 'express';

export const getAllComments = async (match: any): Promise<IComments[]> => {
  return await CommentsModel.find(match);
};

export const getDataById = async (id: string): Promise<IComments | null> => {
  return await CommentsModel.findById(id);
};

export const insertComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newComment = new CommentsModel(req.body);
    const data = await newComment.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body, params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await CommentsModel.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeComment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await CommentsModel.findById(req.params.id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await CommentsModel.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};