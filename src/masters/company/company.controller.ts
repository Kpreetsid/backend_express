import { get } from "lodash";
import { USER_ROLES, IUser } from '../../models/user.model';
import { NextFunction, Request, Response } from 'express';
import { companyService } from './company.service';
import mongoose from "mongoose";
import { applyRoleFilter } from "../../util/roleFilter";

class CompanyController {

  async getCompanies (req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.query;
      const baseFilter = {};
      if (type) baseFilter["type"] = type;
      const filter = applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, accountField: "_id" });
      const data = await companyService.getAllCompanies(filter);
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async getCompany (req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error("Invalid ID"), { status: 400 });
      }
      if (USER_ROLES.includes(userRole) && `${account_id}` !== id) {
        throw Object.assign(new Error("Invalid ID"), { status: 400 });
      }
      const baseFilter = { _id: new mongoose.Types.ObjectId(id) };
      const filter = applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, accountField: "_id" });
      const data = await companyService.getAllCompanies(filter);
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async create (req: Request, res: Response, next: NextFunction) {
    try {
      const newCompany = {
        account_name: req.body.account_name,
        type: req.body.type,
        description: req.body.description
      };
      const data = await companyService.createCompany(newCompany);
      if (!data) throw Object.assign(new Error("Data creation failed"), { status: 500 });
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async updateCompany (req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { account_name, type, description } = req.body;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) throw Object.assign(new Error("No data found"), { status: 404 });
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (`${account_id}` !== id) throw Object.assign(new Error("Invalid ID"), { status: 400 });
      const updatedObj = {
        account_name,
        type,
        description,
        updatedBy: user_id
      };
      const data = await companyService.updateById(id, updatedObj);
      if (!data) throw Object.assign(new Error("Data update failed"), { status: 500 });
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async updateImageCompany (req: Request, res: Response, next: NextFunction) {
    try {
      const { params: { id }, body: { fileName }} = req;
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) throw Object.assign(new Error("No data found"), { status: 404 });
      if (!fileName) throw Object.assign(new Error("File name is required"), { status: 400 });
      if (`${account_id}` !== id) throw Object.assign(new Error("Invalid ID"), { status: 400 });
      const updatedObj = { fileName, updatedBy: user_id };
      const data = await companyService.updateById(id, updatedObj);
      if (!data) throw Object.assign(new Error("Data update failed"), { status: 500 });
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async removeCompany (req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(Object.assign(new Error("Invalid ID"), { status: 400 }));
      }
      const { _id: userId } = get(req, "user", {}) as IUser;
      const deleted = await companyService.removeById(id, userId);
      if (!deleted) {
        return next(Object.assign(new Error("No data found"), { status: 404 }));
      }
      return res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      return next(error);
    }
  };
}

export const companyController = new CompanyController();