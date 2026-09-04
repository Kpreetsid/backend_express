import { NextFunction, Request, Response } from 'express';
import { uploadService } from '../services/upload.service';

class UploadController {
  async uploadController(req: Request, res: Response, next: NextFunction): Promise<any> {
    await uploadService.uploadService(req, res, next);
  }

  async uploadBaseImage(req: Request, res: Response, next: NextFunction): Promise<any> {
    await uploadService.uploadBaseImageService(req, res, next);
  }
}

export const uploadController = new UploadController();