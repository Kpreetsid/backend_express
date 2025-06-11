import { Request, Response, NextFunction } from "express";
import { get } from 'lodash';
import { IUser } from "../models/user.model";

export const hasPermission = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { user_role: userRole } = get(req, 'user', {}) as IUser;
    if(userRole !== role) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    next();
  }
}

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

export const usedDevice = async (req: Request, device: 'mobile' | 'tablet' | 'desktop'): Promise<boolean> => {
  const { isMobile, isTablet, isDesktop } = get(req, 'device', {}) as any;
  const deviceMap = {
    mobile: isMobile,
    tablet: isTablet,
    desktop: isDesktop,
  };
  return deviceMap[device] === true;
};