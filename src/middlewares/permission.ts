import { Request, Response, NextFunction } from "express";
import { get } from 'lodash';
import { IUserRoleMenu } from "../models/userRoleMenu.model";

export const hasRolePermission = (moduleName: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = get(req, "role", {}) as IUserRoleMenu;
      if (!role?.[moduleName]?.[action]) {
        throw Object.assign(new Error("You do not have permission to access."), { status: 403 });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};