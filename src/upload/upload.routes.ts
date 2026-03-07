import express from 'express';
const router = express.Router();
import { uploadController } from './upload.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
    const date = new Date();
    const istDate = date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    
    const timestamp = istDate
      .replace(/,/g, "")
      .replace(/\//g, "-")
      .replace(/:/g, "-")
      .replace(/\s/g, "-");

    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '-'); // User said replace space with -
    cb(null, `${timestamp}_${baseName}${ext}`);
  }
});

export const upload = multer({ storage, limits: { files: 12, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});

export default (): express.Router => {
    router.post('/', upload.array('files', 12), uploadController.uploadController);
    router.post('/baseImage', uploadController.uploadBaseImage);
    router.post('/baseImage/:folderName', uploadController.uploadBaseImage);
    router.post('/:folderName', upload.array('files', 12), uploadController.uploadController);
    return router;
}