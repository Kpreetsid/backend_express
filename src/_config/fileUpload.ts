import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

export const uploadSingle = (fieldName: string) => {
  return multer({ storage }).single(fieldName);
};

export const uploadMultiple = (fieldName: string, maxCount: number = 5) => {
  return multer({ storage }).array(fieldName, maxCount);
};
