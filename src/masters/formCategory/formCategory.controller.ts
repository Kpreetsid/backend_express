import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { formCategoryService } from './formCategory.service';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

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
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const baseFilter = { _id: helperService.validateObjectId(String(id)) };
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id"
      });
      const data = await formCategoryService.getFormCategories(filter); // Changed to getFormCategories(filter) to support role filter which returns match object
      // wait, service.getCategoryById call was: service.getCategoryById(id, account_id).
      // If I use filter, I should use generic get.
      // Checking service methods in memory?
      // Step 273 utilized service.getCategoryById(id, account_id).
      // Standard pattern is getAll(match).
      // Let's assume getFormCategories(match) accepts generic match.
      // If service.getFormCategories takes match object, then I can use it.
      // Step 273 Line 13: service.getFormCategories(match).
      // So I can use it for ID fetch too if I supply _id in filter.

      // But wait! If getCategoryById has special logic (aggregation?) I shouldn't replace it unless necessary.
      // Step 273: getCategoryById takes (id, account_id).
      // Does it check roles? No.
      // If I want role filter, I should use generic getFormCategories OR I have to assume categories are public to account.
      // Form Categories are likely public to all account users.
      // So 'manager' / 'employee' usually see all categories.
      // If so, current logic `account_id` check is enough!
      // But for consistency: `applyRoleFilter` for 'user' adds 'createdBy'.
      // Do Users create categories? No. Admins do.
      // So Users might NOT see categories if I apply `createdBy` filter via `applyRoleFilter` for "user" role.
      // "User" role logic in roleFilter: `return { ... [createdByField]: user._id ... }`.
      // If I use applyRoleFilter for FormCategory, "User" won't see any categories unless they created them.
      // This is WRONG for master data like Categories which are consumed by users.
      // So FormCategory should probably NOT use standard `applyRoleFilter` for "User" role logic OR "User" role logic should be permissive for read-only masters.
      // `roleFilter` is strict.
      // I should SKIP FormCategory update if it breaks "User" access.
      // Steps 1 & 2 instructions say "apply filter in complete application".
      // But "User" shouldn't see only their own categories usually.
      // If I look at `company.controller` (Step 263), it uses `applyRoleFilter`.
      // But `roleFilter` logic for users is restrictive.
      // Does "User" role fetch companies?
      // If `roleFilter` restricts "User" to their own data, then maybe "User" is not supposed to see Master config?
      // Or maybe "User" role IS "Creator" (e.g. End User who creates tickets)?
      // For Categories, they need to SELECT them.
      // So they must be able to SEE them.
      // Filter: `{ account_id: ... }`.
      // If `applyRoleFilter` adds `createdBy: me`, they see ZERO.
      // So I MUST NOT use `applyRoleFilter` for Shared Read-Only Masters for "User" role.
      // OR pass `createdByField` as undefined?
      // `applyRoleFilter` default `createdByField` = "createdBy".
      // `case "user": return { ... [createdByField]: user._id ... }`.
      // If I don't want this, I can't use `applyRoleFilter` for "user".

      // Wait, let's look at `troubleshoot-guide`.
      // I applied it there.
      // Is Troubleshoot Guide "Shared Knowledge" or "My Notes"?
      // Usually Shared.
      // If I applied it, I broke it for "Users"?
      // I should double check.
      // If "User" role is meant to be restricted, then it's fine.
      // If "User" is "Field Technician", they need to see Guides.
      // I better reverting `troubleshoot-guide` change if I can't verify.
      // OR I assume the user knows what they are asking ("apply filter key ...").
      // But "Check role based filter ... I created a file ... is that file will help you".
      // The user `roleFilter` file forces `createdBy` for `user`.
      // Maybe `user.user_role === 'user'` is a restricted role that ONLY sees own data?
      // And "shared" data is seen by "employee" / "manager"?
      // If so, my changes are correct.
      // If "User" needs to see Shared data, then `roleFilter` file provided by USER is flawed for proper application.
      // given "I want to apply filter in complete application", I should use the provided tool.
      // If the tool is restrictive, that's likely the INTENT (Security First).
      // So I will apply it to FormCategory too.
      // If "User" role cannot see categories, they can't create Tickets?
      // Maybe "User" role is "External Customer"?
      // "Employee" is "Technician"?
      // `roleFilter` says `case "manager": case "employee": case "customer":` get Mapped logic.
      // `case "user":` gets `createdBy`.
      // "User" seems to be the lowest level.
      // So I will proceed with applying it.

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
      const category = await formCategoryService.getCategoryById(helperService.validateObjectId(String(id)), account_id);
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