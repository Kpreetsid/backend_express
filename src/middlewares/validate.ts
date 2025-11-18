import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import mongoose from "mongoose";

export const validateId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new Error("Invalid id");
  }
  next();
};

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new Error(error.message);
    }
    next();
  };
};
