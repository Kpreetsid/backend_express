import { Request, Response, NextFunction } from "express";
import { get } from "lodash";
import { IUserRoleMenu } from "../models/userRoleMenu.model";
import { IUser, USER_ROLES } from "../models/user.model";
import { AccountAction, accountAccessService } from "../_role/accountAccess.service";

const denyAccountFeature = (
  req: Request,
  res: Response,
  featureKey: string,
  action: AccountAction
): Response => {
  return res.status(403).json({
    status: false,
    code: "ACCOUNT_FEATURE_DISABLED",
    message: "This feature is disabled for the account.",
    featureKey,
    action,
    accountPermissionVersion: Number((req as any).accountPermissionVersion || 0)
  });
};

const hasEffectivePermission = (req: Request, menuKey: string, action: AccountAction): boolean => {
  const roleMenu: any = get(req, "roleMenu", {});
  return accountAccessService.isEffectivePermissionEnabled(roleMenu, menuKey, action);
};

const validateFeatureRule = (menuKey: string, action: AccountAction): void => {
  if (!accountAccessService.isKnownFeature(menuKey)) {
    throw new Error(`Unknown account feature key configured: ${menuKey}`);
  }
  if (!accountAccessService.isKnownAction(action)) {
    throw new Error(`Unknown account feature action configured: ${action}`);
  }
};

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

export const hasAccountFeature = (menuKey: string, action: AccountAction = "view") => {
  validateFeatureRule(menuKey, action);
  return (req: Request, res: Response, next: NextFunction) => {
    if (hasEffectivePermission(req, menuKey, action)) {
      return next();
    }
    return denyAccountFeature(req, res, menuKey, action);
  };
};

export const hasAnyAccountFeature = (menuKeys: string[], action: AccountAction = "view") => {
  menuKeys.forEach((menuKey) => validateFeatureRule(menuKey, action));
  return (req: Request, res: Response, next: NextFunction) => {
    if (menuKeys.some((menuKey) => hasEffectivePermission(req, menuKey, action))) {
      return next();
    }
    return denyAccountFeature(req, res, menuKeys.join("|"), action);
  };
};

export const hasAccountFeatures = (menuKeys: string[], action: AccountAction = "view") => {
  menuKeys.forEach((menuKey) => validateFeatureRule(menuKey, action));
  return (req: Request, res: Response, next: NextFunction) => {
    if (menuKeys.every((menuKey) => hasEffectivePermission(req, menuKey, action))) {
      return next();
    }
    const deniedFeature = menuKeys.find((menuKey) => !hasEffectivePermission(req, menuKey, action)) || menuKeys[0];
    return denyAccountFeature(req, res, deniedFeature, action);
  };
};

export const hasAnyRolePermission = (moduleName: string, actions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const roleMenu: any = get(req, "role", {}) as IUserRoleMenu;
      if (!user?.user_role || !USER_ROLES.includes(user.user_role)) {
        throw Object.assign(new Error("Invalid or missing user role"), { status: 403 });
      }
      if (!actions.some(action => roleMenu?.[moduleName]?.[action] === true)) {
        throw Object.assign(new Error("You do not have permission to access."), { status: 403 });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
