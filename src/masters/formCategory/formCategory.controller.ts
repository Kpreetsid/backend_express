import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getFormCategories, createFormCategory, updateById, removeById } from './formCategory.service';
import { IUser } from '../../models/user.model';

export const getAllFormCategories = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    // const match: any = { account_id: account_id };
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match.user_id = user_id;
    }
    const data = await getFormCategories(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getFormCategoryByID = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    // const match: any = { _id: req.params.id, account_id: account_id };
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match.user_id = user_id;
    }
    const data = await getFormCategories(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const { body } = req;
    const data = await createFormCategory(body, user);
    if (!data) {
      throw Object.assign(new Error('Failed to create category'), { status: 400 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const updateFormCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('No category ID provided'), { status: 400 });
    }
    const isData = await getFormCategories({ _id: id, account_id: user.account_id });
    if (!isData || isData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateById(id, body, user);
    if (!data) {
      throw Object.assign(new Error('Failed to update form category'), { status: 400 });
    }
    res.status(200).json({ status: true, message: "Form category updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const removeFormCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const isData = await getFormCategories({ _id: req.params.id, account_id: account_id });
    if (!isData || isData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    await removeById(req.params.id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}