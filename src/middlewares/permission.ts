import { Request, Response, NextFunction } from "express";
import { get } from 'lodash';
import { IUser } from "../models/user.model";
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

export const hasPermission = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = get(req, 'user.user_role');
    if (userRole !== role) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    next();
  };
};

export const isOwner = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = get(req, 'user', {}) as IUser;
    const userIdFromToken = user._id || user.id;
    const targetId = req.params.id;
    if (userIdFromToken !== targetId) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const isOwnerOrAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { _id: userId, user_role: role } = get(req, 'user', {}) as IUser;
    const { id: targetId } = req.params;
    if (role === 'admin' || userId === targetId.toString()) {
      return next();
    }
    throw Object.assign(new Error('Unauthorized access'), { status: 403 });
  } catch (error) {
    next(error);
  }
};