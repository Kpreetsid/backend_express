import { Request, Response, NextFunction } from "express";
import { get } from "lodash";
import { IUserRoleMenu } from "../models/userRoleMenu.model";
import { IUser, USER_ROLES } from "../models/user.model";

export const hasRolePermission = (moduleName: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const roleMenu: any = get(req, "role", {}) as IUserRoleMenu;
      if (!user?.user_role) {
        throw Object.assign(new Error("Unauthorized access"), { status: 403 });
      }
      if (USER_ROLES.includes(user.user_role)) {
        if (!roleMenu?.[moduleName]?.[action]) {
          throw Object.assign(new Error("You do not have permission to access."), { status: 403 });
        }
        return next();
      }
      throw Object.assign(new Error("Invalid user role"), { status: 403 });
    } catch (err) {
      next(err);
    }
  };
};

export const hasAccountFeature = (menuKey: string, action: string = "view") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleMenu: any = get(req, "roleMenu", {});
    const permission = roleMenu?.[menuKey];

    if (permission?.[action] === true) {
      return next();
    }

    next(Object.assign(new Error("This feature is disabled for the account."), {
      status: 403,
      code: "ACCOUNT_FEATURE_DISABLED"
    }));
  };
};

export const hasAnyAccountFeature = (menuKeys: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleMenu: any = get(req, "roleMenu", {});
    if (menuKeys.some((menuKey) => roleMenu?.[menuKey]?.view === true)) {
      return next();
    }

    next(Object.assign(new Error("This feature is disabled for the account."), {
      status: 403,
      code: "ACCOUNT_FEATURE_DISABLED"
    }));
  };
};
