import { get } from "lodash";
import { USER_ROLES, IUser } from "../../models/user.model";
import { NextFunction, Request, Response } from "express";
import { companyService } from "./company.service";
import { helperService } from "../../util/helper";
import { applyRoleFilter } from "../../util/roleFilter";

class CompanyController {

  getCompanies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      const baseFilter = {};
      if (type) baseFilter["type"] = type;
      const filter = await applyRoleFilter({
        user: get(req, "user", {}) as IUser,
        baseFilter,
        accountField: "_id",
      });
      const data = await companyService.getAllCompanies(filter);
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (USER_ROLES.includes(userRole) && `${account_id}` !== id) {
        throw Object.assign(new Error("Invalid ID"), { status: 400 });
      }
      const baseFilter = { _id: helperService.validateObjectId(String(id)) };
      const filter = await applyRoleFilter({
        user: get(req, "user", {}) as IUser,
        baseFilter,
        accountField: "_id",
      });
      const data = await companyService.getAllCompanies(filter);
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newCompany = {
        account_name: req.body.account_name,
        type: req.body.type,
        description: req.body.description,
      };
      const data = await companyService.createCompany(newCompany);
      if (!data)
        throw Object.assign(new Error("Data creation failed"), { status: 500 });
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  updateCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { account_name, type, description } = req.body;
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (id !== String(account_id)) {
        throw Object.assign(new Error("Invalid ID"), { status: 400 });
      }
      const updatedObj = {
        account_name,
        type,
        description,
        updatedBy: user_id,
      };
      const data = await companyService.updateById(
        helperService.validateObjectId(String(id)),
        updatedObj,
      );
      if (!data)
        throw Object.assign(new Error("Data update failed"), { status: 500 });
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  updateImageCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        params: { id },
        body: { fileName },
      } = req;
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (!fileName)
        throw Object.assign(new Error("File name is required"), {
          status: 400,
        });
      if (String(account_id) !== id) {
        throw Object.assign(new Error("Invalid ID"), { status: 400 });
      }
      const updatedObj = { fileName, updatedBy: user_id };
      const data = await companyService.updateById(
        helperService.validateObjectId(String(id)),
        updatedObj,
      );
      if (!data)
        throw Object.assign(new Error("Data update failed"), { status: 500 });
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  removeCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { _id: userId } = get(req, "user", {}) as IUser;
      const deleted = await companyService.removeById(
        helperService.validateObjectId(String(id)),
        userId,
      );
      if (!deleted) {
        return next(Object.assign(new Error("No data found"), { status: 404 }));
      }
      return res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      return next(error);
    }
  }
}

export const companyController = new CompanyController();
