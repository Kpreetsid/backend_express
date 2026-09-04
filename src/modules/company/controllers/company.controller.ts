import { controllerCache } from '../../../core/cache/controller-cache.service';
import { get } from "lodash";
import { USER_ROLES, IUser } from "../../users/models/user.model";
import { NextFunction, Request, Response } from "express";
import { companyService } from "../services/company.service";
import { helperService } from "../../../common/utils/object-id.helper";
import { applyRoleFilter } from "../../../common/utils/role-filter.helper";
import { accountFeatureService } from "../services/accountFeature.service";
import { subscriptionLimitService } from "../services/subscriptionLimit.service";

class CompanyController {

  getSubscriptionLimits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const data = await subscriptionLimitService.getUsage(account_id);
      res.status(200).json({
        status: true,
        message: "Subscription limits retrieved successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  }

  getCompanies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      const baseFilter: any = {};
      if (type) baseFilter["type"] = type;
      const filter = await applyRoleFilter({
        user: get(req, "user", {}) as IUser,
        baseFilter,
        accountField: "_id",
      });
      const data = await companyService.getAllCompanies(filter);
      if (!data.length) {
        throw Object.assign(new Error("No companies found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Companies retrieved successfully", data });
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
        throw Object.assign(new Error("Company not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Company retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_name, type, description, cookie_status, redis_status, encrypt_payload, encrypt_response } = req.body;
      if (!account_name || !type) {
        throw Object.assign(new Error("Account name and type are required"), { status: 400 });
      }
      const newCompany = {
        account_name,
        type,
        description,
        cookie_status,
        redis_status,
        encrypt_payload,
        encrypt_response,
      };
      const data = await companyService.createCompany(newCompany);
      if (!data)
        throw Object.assign(new Error("Failed to create company"), { status: 500 });
      accountFeatureService.clear(String((data as any)._id));
      res.status(201).json({ status: true, message: "Company created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  updateCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { account_name, type, description, cookie_status, redis_status, encrypt_payload, encrypt_response } = req.body;
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (id !== String(account_id)) {
        throw Object.assign(new Error("Invalid account ID"), { status: 400 });
      }
      if (!account_name || !type) {
        throw Object.assign(new Error("Account name and type are required"), { status: 400 });
      }
      const updatedObj = {
        account_name,
        type,
        description,
        cookie_status,
        redis_status,
        encrypt_payload,
        encrypt_response,
        updatedBy: user_id,
      };
      const data = await companyService.updateById(
        helperService.validateObjectId(String(id)),
        updatedObj,
      );
      if (!data)
        throw Object.assign(new Error("Failed to update company"), { status: 500 });
      accountFeatureService.clear(String(id));
      res.status(200).json({ status: true, message: "Company updated successfully", data });
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
      res.status(200).json({ status: true, message: "Company updated successfully", data });
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
        return next(Object.assign(new Error("Company not found"), { status: 404 }));
      }
      accountFeatureService.clear(String(id));
      return res.status(200).json({ status: true, message: "Company deleted successfully" });
    } catch (error) {
      return next(error);
    }
  }
}

export const companyController = controllerCache.withCache(new CompanyController(), {
  namespace: 'companies',
  ttlSeconds: 300,
  tags: ['companies', 'settings', 'users'],
  skipMethods: ['getSubscriptionLimits']
});
