import express, { NextFunction, Request, Response } from 'express';
import { uploadService } from './upload.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const router = express.Router();

const uploadRoot = path.join(__dirname, '../../uploadFiles');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderName = JSON.parse(JSON.stringify(req.params)).folderName;
    if (folderName) {
      const targetDir = path.join(uploadRoot, folderName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    } else {
      cb(null, uploadRoot)
    }
  },
  filename: function (req, file, cb) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${timestamp}_${baseName}${ext}`);
  }
});

const upload = multer({ storage: storage });

router.post('/:folderName', upload.array('files', 5), uploadController);

async function uploadController(req: Request, res: Response, next: NextFunction) {
  await uploadService(req, res, next);
}

export default router;