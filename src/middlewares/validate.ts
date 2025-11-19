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
      if (error.details.length > 0) {
        for (const err of error.details) {
          throw new Error(formatJoiError(err));
        }
      }
    }
    next();
  };
};

const formatJoiError = (err: Joi.ValidationErrorItem): string => {
  const field = err.path.join(".");
  switch (err.type) {
    case "any.required":
      return `${field} is required`;
    case "string.base":
      return `${field} must be a string`;
    case "string.empty":
      return `${field} cannot be empty`;
    case "string.min":
      return `${field} should have at least ${err.context?.limit} characters`;
    case "string.max":
      return `${field} should have at most ${err.context?.limit} characters`;
    case "string.pattern.base":
      return `${field} format is invalid`;
    case "number.base":
      return `${field} must be a number`;
    case "number.min":
      return `${field} should be at least ${err.context?.limit}`;
    case "number.max":
      return `${field} should be at most ${err.context?.limit}`;
    case "object.base":
      return `${field} must be an object`;
    case "array.base":
      return `${field} must be an array`;
    case "array.min":
      return `${field} must contain at least ${err.context?.limit} items`;
    case "array.max":
      return `${field} must contain at most ${err.context?.limit} items`;
    case "boolean.base":
      return `${field} must be a boolean`;
    case "any.only":
      return `${field} contains an invalid value`;
    default:
      return err.message.replace(/"/g, "");
  }
};