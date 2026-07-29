import express from 'express';
import { rateLimiter } from '../middlewares/rateLimits';
const router = express.Router();
import { uploadController } from './upload.controller';
import multer from 'multer';
import path from 'path';
import { uploadFilesService } from './upload.multer';
import { payloadCryptoMultipartMiddleware } from '../middlewares/payloadCrypto.middleware';
import { enforceUploadPermission } from '../middlewares/uploadPermission.middleware';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { folderName } = req.params as { folderName?: string };
    const destination = uploadFilesService.getDestinationPath(folderName);
    cb(null, destination);
  },
  filename: function (req, file, cb) {
    const { folderName } = req.params as { folderName?: string };
    const accountId = (req as any).user?.account_id;
    const ext = path.extname(file.originalname);
    
    const fileName = uploadFilesService.generateFileName(ext, folderName, accountId);
    cb(null, fileName);
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
    router.use(rateLimiter.uploadLimiter);
    router.post('/', upload.array('files', 12), payloadCryptoMultipartMiddleware, uploadController.uploadController);
    router.post('/baseImage', enforceUploadPermission, uploadController.uploadBaseImage);
    router.post('/baseImage/:folderName', enforceUploadPermission, uploadController.uploadBaseImage);
    router.post('/:folderName', enforceUploadPermission, upload.array('files', 12), payloadCryptoMultipartMiddleware, uploadController.uploadController);
    return router;
}
