import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { validationResult } from "express-validator";

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

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors: string[] = [];
  errors.array().map(err => extractedErrors.push(err.msg));

  return res.status(422).json({
    status: false,
    message: 'Validation Error',
    errors: extractedErrors,
    error: extractedErrors[0]
  });
};