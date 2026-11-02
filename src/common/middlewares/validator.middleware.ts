import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

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
    error: extractedErrors[0] // For backward compatibility with existing error handling
  });
};
