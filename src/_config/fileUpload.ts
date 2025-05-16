import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = ['image/jpg', 'image/jpeg', 'image/png', 'application/pdf'];

const uploadDir = path.join(__dirname, '../../uploadFiles');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${timestamp}_${baseName}${ext}`);
  }
});


const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unsupported file type: ${file.mimetype}`));
  }
};

export const uploadFiles = (fieldName: string, maxCount: number = 5) => {
  return multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: maxCount
    },
    fileFilter
  }).array(fieldName, maxCount);
};
