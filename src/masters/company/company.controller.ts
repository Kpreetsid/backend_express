import { get } from "lodash";
import { IUser } from '../../models/user.model';
import express, { NextFunction, Request, Response } from 'express';
import { getAllCompanies, createCompany, updateById, removeById } from './company.service';

export const getCompanies = async (req: Request, res: Response, next: NextFunction) => {
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
    console.error(error);
    next(error);
  }
}

export const getCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const match: any = { _id: id };
    if(account_id.toString() !== id) {
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
    console.error(error);
    next(error);
  }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
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
    console.error(error);
    next(error);
  }
}

export const updateCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const updatedCompany = {
      account_name: req.body.account_name,
      type: req.body.type,
      description: req.body.description,
      
    }
    await updateById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const result = await removeById(req.params.id, account_id, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}