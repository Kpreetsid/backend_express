import { Request, Response, NextFunction } from 'express';

export const getInstructions = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    return res.status(200).json({ status: true, message: "Data fetched successfully" });
  } catch (error) {
    next(error);
  }
};
