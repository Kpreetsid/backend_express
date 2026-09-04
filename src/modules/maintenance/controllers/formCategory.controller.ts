import { controllerCache } from '../../../core/cache/controller-cache.service';

import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { formCategoryService } from '../services/formCategory.service';
import { IUser } from '../../users/models/user.model';
import { helperService } from '../../../common/utils/object-id.helper';
import { applyRoleFilter } from '../../../common/utils/role-filter.helper';

class FormCategoryController {

  getAllFormCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter = { account_id: user.account_id, visible: true };
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id"
      });
      const data = await formCategoryService.getFormCategories(filter);
      res.status(200).json({ status: true, message: "Categories fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getFormCategoryByID = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const baseFilter = { _id: helperService.validateObjectId(String(id)) };
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id"
      });
      const data = await formCategoryService.getFormCategories(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Category not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Category fetched successfully", data: data[0] });
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
      const category = await formCategoryService.getCategoryById(helperService.validateObjectId(String(id)), user.account_id);
      if (!category) {
        throw Object.assign(new Error('Category not found'), { status: 404 });
      }
      const nextName = body.name !== undefined ? body.name : category.name;
      const nameExists = await formCategoryService.categoryExists(user.account_id, nextName, String(id));
      if (nameExists) {
        throw Object.assign(new Error(`Category name already exists`), { status: 400 });
      }
      const data = await formCategoryService.updateById(String(id), {
        name: nextName,
        description: body.description !== undefined ? body.description : category.description
      }, user);
      res.status(200).json({ status: true, message: "Category updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { id } = req.params;
      const category = await formCategoryService.getCategoryById(helperService.validateObjectId(String(id)), account_id);
      if (!category) {
        throw Object.assign(new Error('Category not found'), { status: 404 });
      }
      await formCategoryService.removeById(String(id), user);
      res.status(200).json({ status: true, message: "Category deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const formCategoryController = controllerCache.withCache(new FormCategoryController(), { namespace: 'form-categories', ttlSeconds: 600, tags: ['form-categories'] });

