import { Request, Response, NextFunction } from 'express';
import { getSOPs, createSOPs, updateSOPs, removeSOPs } from './sops.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const { category, location } = req.query;
    if (category) {
      match.categoryId = { $in: category.toString().split(',').filter((cat) => cat && cat.trim() !== '') };
    }
    if (location) {
      match.locationId = { $in: location.toString().split(',').filter((loc) => loc && loc.trim() !== '') };
    }
    let data = await getSOPs(match);
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getSop = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { query: { category, location }, params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('Id is required'), { status: 400 });
    }
    const match: any = { account_id: account_id };
    if (category) {
      match.categoryId = { $in: category.toString().split(',').filter((cat) => cat && cat.trim() !== '') };
    }
    if (location) {
      match.locationId = { $in: location.toString().split(',').filter((loc) => loc && loc.trim() !== '') };
    }
    let data = await getSOPs(match);
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const data = await createSOPs(req.body, account_id, user_id);
    return res.status(200).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('Id is required'), { status: 400 });
    }
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const existingData = await getSOPs({ _id: id, account_id: account_id, visible: true });
    if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateSOPs(id, body, user_id);
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('Id is required'), { status: 400 });
    }
    const existingData = await getSOPs({ _id: id, account_id: account_id, visible: true });
    if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeSOPs(id, user_id);
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}