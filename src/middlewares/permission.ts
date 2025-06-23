import { Request, Response, NextFunction } from "express";
import { get } from 'lodash';
import { IUser } from "../models/user.model";

export const hasPermission = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = get(req, 'user.user_role');
    if (userRole !== role) {
      return next(Object.assign(new Error('Unauthorized access'), { status: 403 }));
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
    console.error(error);
    next(error);
  }
};

export const isOwnerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
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