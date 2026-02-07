import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export const validateParamId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) {
    throw Object.assign(new Error("Id is required"), { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw Object.assign(new Error("Invalid id"), { status: 400 });
  }
  next();
};