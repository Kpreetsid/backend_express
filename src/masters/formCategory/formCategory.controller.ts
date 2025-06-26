import express, { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getFormCategories, insert, updateById, removeById } from './formCategory.service';
import { IUser } from '../../models/user.model';

export const getAllFormCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await getFormCategories(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getFormCategoryByID = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await getFormCategories(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const createFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await insert(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const updateFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const isData = await getFormCategories({ _id: req.params.id, account_id: account_id });
    if (!isData || isData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    await removeById(req.params.id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}