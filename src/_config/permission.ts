import { Request, Response, NextFunction } from "express";

export const hasPermission = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { user_role: userRole } = req.user;
    if(userRole !== role) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    next();
  }
}

export const isOwner = (req: Request, res: Response, next: NextFunction) => {
  try {
    const userIdFromToken = req.user._id || req.user.id;
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
    const { _id: userId, user_role: role } = req.user;
    const { id: targetId } = req.params;
    if (role === 'admin' || userId.toString() === targetId.toString()) {
      return next();
    }
    throw Object.assign(new Error('Unauthorized access'), { status: 403 });
  } catch (error) {
    next(error);
  }
};