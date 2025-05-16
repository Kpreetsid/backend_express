import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();

import { uploadService } from './upload.service';
import { uploadFiles } from '../_config/fileUpload';

router.post('/', uploadFiles('files'), uploadController);

async function uploadController(req: Request, res: Response, next: NextFunction) {
  await uploadService(req, res, next);
}

export default router;