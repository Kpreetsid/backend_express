import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../models/user.model';
import { getAllInspection, createInspection, updateInspection, removeInspection } from './inspection.service';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;

    const match = { account_id, visible: true };

    const data = await getAllInspection(match);

    if (!data.length) {
      throw Object.assign(new Error('No inspections data found'), { status: 404 });
    }

    res.status(200).json({ status: true, message: "Inspections fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const data = await getAllInspection({ _id: id, account_id, visible: true });
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection fetched successfully", data: data[0] });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const data = await createInspection(req.body, account_id, user_id);
    res.status(201).json({ status: true, message: "Inspection created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const data = await updateInspection(id, req.body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const data = await getAllInspection({ _id: id, account_id, visible: true });
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    const result = await removeInspection(id, account_id, user_id);
    if (!result) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection deleted successfully" });
  } catch (error) {
    next(error);
  }
};
