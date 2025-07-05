import { Request, Response, NextFunction } from 'express';
import { UploadModel } from '../models/upload.model';
import { uploadBase64Image } from '../_config/upload';

export const uploadService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files: any = req.files;
    const { folderName } = req.params;
    if (!req.files || req.files.length === 0) {
      throw Object.assign(new Error('No files uploaded'), { status: 400 });
    }
    const data = files.map((file: any) => {
      let fileURL = `${req.protocol}://${req.get('host')}/${file.filename}`;
      const data = new UploadModel({
        "originalName": file.originalname,
        "type": file.mimetype,
        "destination": file.destination,
        "fileName": file.filename,
        "fileUrl": fileURL,
        "filePath": file.path,
        "size": file.size
      });
      if (folderName) {
        data.fileURL = `${req.protocol}://${req.get('host')}/${folderName}/${file.filename}`;
        data.folderName = folderName;
      }
      return data;
    });
    return res.status(200).send({ status: true, message: 'Files uploaded successfully', data });
 } catch (error: any) {
    next(error);
  }
};

export const uploadBaseImageService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { baseImage, folderName } = req.body;
    if (!baseImage || typeof baseImage !== "string") {
      throw Object.assign(new Error('Base64 image data is required'), { status: 400 });
    }
    const fileInfo = await uploadBase64Image(baseImage, folderName);
    return res.status(200).send({ status: true, message: "File uploaded successfully", data: fileInfo });
 } catch (error: any) {
    next(error);
  }
};