import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { formCategoryService } from './formCategory.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

class FormCategoryController {
  validateObjectId = (id: string): mongoose.Types.ObjectId => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error("Invalid ID"), { status: 400 });
    }
    return new mongoose.Types.ObjectId(id);
  };

  validateObjectIds = (ids: string): mongoose.Types.ObjectId[] => {
    const idsArray = ids.split(",");
    if (idsArray.length === 0) {
      throw Object.assign(new Error("Invalid IDs"), { status: 400 });
    }
    return idsArray.map((id) => this.validateObjectId(id));
  };

  getAllFormCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match = { account_id, visible: true };
      const data = await formCategoryService.getFormCategories(match);
      if (data.length === 0) {
        throw Object.assign(new Error('No categories found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Categories fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getFormCategoryByID = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Invalid category ID'), { status: 400 });
      }
      const data = await formCategoryService.getCategoryById(String(id), account_id);
      if (!data) {
        throw Object.assign(new Error('Category not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Category fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { body } = req;
      if (!body.name || typeof body.name !== "string") {
        throw Object.assign(new Error("Category name is required"), { status: 400 });
      }
      const exists = await formCategoryService.categoryExists(user.account_id, body.name);
      if (exists) {
        throw Object.assign(new Error(`${body.name} category already exists`), { status: 400 });
      }
      const data = await formCategoryService.createFormCategory(body, user);
      res.status(201).json({ status: true, message: "Category created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Invalid category ID'), { status: 400 });
      }
      const category = await formCategoryService.getCategoryById(String(id), user.account_id);
      if (!category) {
        throw Object.assign(new Error('Category not found'), { status: 404 });
      }
      const nameExists = await formCategoryService.categoryExists(user.account_id, body.name, String(id));
      if (nameExists) {
        throw Object.assign(new Error(`Category name already exists`), { status: 400 });
      }
      const data = await formCategoryService.updateById(String(id), body, user);
      res.status(200).json({ status: true, message: "Category updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Invalid category ID'), { status: 400 });
      }
      const category = await formCategoryService.getCategoryById(String(id), account_id);
      if (!category) {
        throw Object.assign(new Error('Category not found'), { status: 404 });
      }
      await formCategoryService.removeById(String(id));
      res.status(200).json({ status: true, message: "Category removed successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const formCategoryController = new FormCategoryController();