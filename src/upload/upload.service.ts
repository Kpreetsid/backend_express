import { Request, Response, NextFunction } from 'express';
import { UploadModel } from '../models/upload.model';
import { uploadFilesService } from './upload.multer';

class UploadService {
  private formatUploadResponse(file: any, req: Request, folderName?: string) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileName = file.filename || file.fileName;
    const fileURL = folderName ? `${baseUrl}/${folderName}/${fileName}` : `${baseUrl}/${fileName}`;
    
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
      const data = files.map((file: any) => this.formatUploadResponse(file, req, folderName));
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
      const accountId = (req as any).user?.account_id;
      const fileInfo = await uploadFilesService.uploadBase64Image(baseImage, folderName, accountId);
      const data = this.formatUploadResponse(fileInfo, req, folderName);
      return res.status(200).send({ status: true, message: "File uploaded successfully", data });
    } catch (error) {
      next(error);
    }
  };
}

export const uploadService = new UploadService();