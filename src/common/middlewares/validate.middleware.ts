import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export const validateParam = (paramName: string) => (req: Request, res: Response, next: NextFunction) => {
  const value = req.params[paramName];
  if (!value) {
    throw Object.assign(new Error(`${paramName} is required`), { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw Object.assign(new Error(`Invalid ${paramName}`), { status: 400 });
  }
  next();
};

export const validateParamId = validateParam("id");