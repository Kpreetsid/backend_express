import { Category, ICategory } from "../../models/formCategory.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getFormCategories = async (match: any) => {
  return await Category.find(match);
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const body = req.body;
     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const newCategoryBody = new Category({
      ...body,
      account_id,
      createdBy: user_id
    })
    const newCategory: ICategory = await newCategoryBody.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: newCategory });
  } catch (error: any) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body: { name, description } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const updatedCategory = await Category.findByIdAndUpdate(id, { name, description }, { new: true });
    if (!updatedCategory) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data: updatedCategory });
  } catch (error: any) {
    next(error);
  }
};

export const removeById = async (id: string) => {
  return await Category.findByIdAndUpdate(id, { visible: false }, { new: true });
};