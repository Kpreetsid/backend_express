import { Request, Response, NextFunction } from 'express';
import { UploadModel } from '../models/upload.model';
import { storageProvider } from '../_config/storage';
import { uploadFilesService } from './upload.multer';

class UploadService {
  private getActorContext(req: Request): {
    accountId: string;
    userId?: string;
  } {
    const user = (req as any).user;
    if (!user?.account_id) {
      throw Object.assign(new Error('Authenticated account is required'), {
        status: 401
      });
    }
    const accountId = String(user.account_id);
    return user._id
      ? { accountId, userId: String(user._id) }
      : { accountId };
  }

  private async formatUploadResponse(file: any, req: Request, folderName?: string) {
    const fileName = file.filename || file.fileName;
    const fileURL = storageProvider.getSignedURL
      ? await storageProvider.getSignedURL(fileName, folderName)
      : storageProvider.getURL(fileName, folderName);
    
    return new UploadModel({
      originalName: file.originalname || file.originalName || fileName,
      type: file.mimetype || file.type,
      destination: file.destination,
      folderName: folderName,
      fileName: fileName,
      fileURL: fileURL,
      filePath: file.path || file.filePath,
      size: file.size
    });
  }

  async uploadService(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const files: any = req.files;
      const { folderName } = req.params as { folderName?: string };
      if (!files || files.length === 0) {
        throw Object.assign(new Error('No files uploaded'), { status: 400 });
      }
      const { accountId, userId } = this.getActorContext(req);
      const persistedFiles = await uploadFilesService.persistMultipartFiles(
        files,
        folderName,
        accountId,
        userId
      );
      const data = await Promise.all(
        persistedFiles.map((file: any) => this.formatUploadResponse(file, req, folderName))
      );
      return res.status(200).send({ status: true, message: 'Files uploaded successfully', data });
    } catch (error) {
      next(error);
    }
  };

  async uploadBaseImageService(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      let { baseImage, folderName: bodyFolderName } = req.body;
      const { folderName: paramsFolderName } = req.params as { folderName?: string };
      const folderName = paramsFolderName || bodyFolderName;
      if (!baseImage || typeof baseImage !== "string") {
        throw Object.assign(new Error('Base64 image data is required'), { status: 400 });
      }
      const { accountId, userId } = this.getActorContext(req);
      const fileInfo = await uploadFilesService.uploadBase64Image(
        baseImage,
        folderName,
        accountId,
        userId
      );
      const data = await this.formatUploadResponse(fileInfo, req, folderName);
      return res.status(200).send({ status: true, message: "File uploaded successfully", data });
    } catch (error) {
      next(error);
    }
  };
}

export const uploadService = new UploadService();
