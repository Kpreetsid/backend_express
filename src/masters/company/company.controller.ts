import { get } from "lodash";
import { IUser } from '../../models/user.model';
import { NextFunction, Request, Response } from 'express';
import { getAllCompanies, createCompany, updateById } from './company.service';

export const getCompanies = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { _id: account_id };
    const { type } = req.query;
    if(type) {
      match.type = type;
    }
    if(userRole !== 'admin') {
      match._id = user_id;
    }
    const data = await getAllCompanies(match);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { _id: req.params.id };
    if(account_id.toString() !== req.params.id) {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    if(userRole !== 'admin') {
      match._id = user_id;
    }
    const data = await getAllCompanies(match);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newCompany = {
      account_name: req.body.account_name,
      type: req.body.type,
      description: req.body.description
    }
    const data = await createCompany(newCompany);
    if(!data) {
      throw Object.assign(new Error('Data creation failed'), { status: 500 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const updateCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const { _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const updatedCompany = {
      account_name: body.account_name,
      type: body.type,
      description: body.description,
      updatedBy: user_id
    }
    const data = await updateById(id, updatedCompany);
    if(!data) {
      throw Object.assign(new Error('Data update failed'), { status: 500 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const updateImageCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body: { fileName } } = req;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if(!fileName) {
      throw Object.assign(new Error('File name is required'), { status: 400 });
    }
    const { _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const updatedCompany = { fileName, updatedBy: user_id };
    const data = await updateById(id, updatedCompany);
    if(!data) {
      throw Object.assign(new Error('Data update failed'), { status: 500 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const removeCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}