import { NextFunction, Request, Response } from 'express';
import { uploadService, uploadBaseImageService } from './upload.service';

export const uploadController = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await uploadService(req, res, next);
}

export const uploadBaseImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await uploadBaseImageService(req, res, next);
}