import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    let match: any = { account_id: account_id };
    if(query) {
      match = { ...match, ...query };
    }
    if(userRole !== 'admin') {
      match.created_by = user_id;
    }
    const data: IWorkRequest[] | null = await WorkRequestModel.find(match)
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if(!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const { account_id } = get(req, "user", {}) as IUser;
    const match = { account_id: account_id, _id: req.params.id, visible: true };
    const data: IWorkRequest[] | null = await WorkRequestModel.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    body.account_id = account_id;
    body.createdBy = user_id;
    const newWorkRequest = new WorkRequestModel(body);
    const data = await newWorkRequest.save();
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
     const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const { _id: user_id } = get(req, "user", {}) as IUser;
    body.updatedBy = user_id;
    const data = await WorkRequestModel.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if(!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await WorkRequestModel.findById(req.params.id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await WorkRequestModel.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};