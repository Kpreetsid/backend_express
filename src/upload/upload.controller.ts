import express, { NextFunction, Request, Response } from 'express';
import { uploadService } from './upload.service';

export const uploadController = async (req: Request, res: Response, next: NextFunction) => {
  await uploadService(req, res, next);
}