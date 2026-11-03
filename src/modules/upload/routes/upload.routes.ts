import express from 'express';
import { rateLimiter } from '@common/middlewares/rate-limit.middleware';
const router = express.Router();
import { uploadController } from '@modules/upload/controllers/upload.controller';
import multer from 'multer';
import path from 'path';
import { uploadFilesService } from '@modules/upload/middlewares/upload.multer';
import { payloadCryptoMultipartMiddleware } from '@common/middlewares/payload-crypto.middleware';
import { enforceUploadPermission } from '@common/middlewares/upload-permission.middleware';
import { enforceUploadSignatures } from '@modules/upload/middlewares/upload-signature';

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
    try {
      const { folderName } = req.params as { folderName?: string };
      uploadFilesService.validateFileMetadata(file.originalname, file.mimetype, folderName);
      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  }
});

export const processUploadedFiles = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  upload.array('files', 12)(req, res, async (uploadError?: any) => {
    const files = Array.isArray(req.files) ? req.files : [];
    if (uploadError) {
      await uploadFilesService.cleanupStoredUploads(files);
      next(uploadError);
      return;
    }
    try {
      const { folderName } = req.params as { folderName?: string };
      await uploadFilesService.validateStoredUploads(files, folderName);
      next();
    } catch (error) {
      next(error);
    }
  });
};

export default (): express.Router => {
    router.use(rateLimiter.uploadLimiter);
    router.post('/', enforceUploadPermission, processUploadedFiles, enforceUploadSignatures, payloadCryptoMultipartMiddleware, uploadController.uploadController);
    router.post('/baseImage', enforceUploadPermission, uploadController.uploadBaseImage);
    router.post('/baseImage/:folderName', enforceUploadPermission, uploadController.uploadBaseImage);
    router.post('/:folderName', enforceUploadPermission, processUploadedFiles, enforceUploadSignatures, payloadCryptoMultipartMiddleware, uploadController.uploadController);
    return router;
}
