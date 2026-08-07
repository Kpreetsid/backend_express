import { Request, Response, NextFunction } from "express";
import { get } from "lodash";
import { IUser, USER_ROLES } from "../models/user.model";

type RolePermission = {
  moduleName: string;
  action: string;
};

const requireKnownUserRole = (req: Request): {
  user: IUser;
  roleMenu: Record<string, Record<string, boolean>>;
} => {
  const user = get(req, "user", {}) as IUser;
  const roleMenu = get(req, "role", {}) as Record<string, Record<string, boolean>>;
  if (!user?.user_role) {
    throw Object.assign(new Error("Unauthorized access"), { status: 403 });
  }
  if (!USER_ROLES.includes(user.user_role)) {
    throw Object.assign(new Error("Invalid user role"), { status: 403 });
  }
  return { user, roleMenu };
};

export const hasRolePermission = (moduleName: string, action: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { roleMenu } = requireKnownUserRole(req);
      if (!roleMenu?.[moduleName]?.[action]) {
        throw Object.assign(new Error("You do not have permission to access."), { status: 403 });
      }
      return next();
    } catch (err) {
      next(err);
    }
  };
};

export const hasAnyRolePermission = (...permissions: RolePermission[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { roleMenu } = requireKnownUserRole(req);
      if (!permissions.some(({ moduleName, action }) => roleMenu?.[moduleName]?.[action])) {
        throw Object.assign(new Error("You do not have permission to access."), { status: 403 });
      }
      return next();
    } catch (err) {
      next(err);
    }
  };
};
