import express from 'express';
import { rateLimiter } from '../middlewares/rateLimits';
const router = express.Router();
import { uploadController } from './upload.controller';
import multer from 'multer';
import path from 'path';
import { uploadFilesService } from './upload.multer';
import { payloadCryptoMultipartMiddleware } from '../middlewares/payloadCrypto.middleware';

import { hasAnyRolePermission, hasRolePermission } from '../middlewares/permission';


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

const upload = multer({ storage, limits: { files: 12, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    try {
      const { folderName } = req.params as { folderName?: string };
      uploadFilesService.validateFileMetadata(file.originalname, file.mimetype, folderName);
      cb(null, true);
    } catch (error) {
      return cb(error as Error);
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

const postUploadPermission = hasAnyRolePermission('posts', ['add', 'edit']);
const observationUploadPermission = hasRolePermission('asset', 'add_observation');
const assetReportUploadPermission = hasAnyRolePermission('asset', ['create_report', 'edit_report']);
const assetImageUploadPermission = hasRolePermission('asset', 'edit_asset');
const locationImageUploadPermission = hasAnyRolePermission('location', ['add_location', 'add_child_location', 'edit_location']);
const floorMapUploadPermission = hasRolePermission('floorMap', 'upload_floor_map');
const requireFolderUploadPermission = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const folderName = req.params.folderName || req.body?.folderName;
  if (folderName === 'posts') {
    postUploadPermission(req, res, next);
    return;
  }
  if (folderName === 'observations') {
    observationUploadPermission(req, res, next);
    return;
  }
  if (folderName === 'asset_report') {
    assetReportUploadPermission(req, res, next);
    return;
  }
  if (folderName === 'assets') {
    assetImageUploadPermission(req, res, next);
    return;
  }
  if (folderName === 'locations') {
    locationImageUploadPermission(req, res, next);
    return;
  }
  if (folderName === 'floor_map') {
    floorMapUploadPermission(req, res, next);
    return;
  }
  next();
};

export default (): express.Router => {
    router.use(rateLimiter.uploadLimiter);

    router.post('/', processUploadedFiles, payloadCryptoMultipartMiddleware, uploadController.uploadController);
    router.post('/baseImage', requireFolderUploadPermission, uploadController.uploadBaseImage);
    router.post('/baseImage/:folderName', requireFolderUploadPermission, uploadController.uploadBaseImage);
    router.post('/:folderName', requireFolderUploadPermission, processUploadedFiles, payloadCryptoMultipartMiddleware, uploadController.uploadController);

    return router;
}
