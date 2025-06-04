import { Request, Response, NextFunction } from 'express';
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const uploadService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const files: any = req.files;
        const { folderName } = req.params;
        if (!req.files || req.files.length === 0) {
            throw Object.assign(new Error('No files uploaded'), { status: 400 });
        }
        const data = files.map((file: any) => {
            let fileURL = `${req.protocol}://${req.get('host')}/${file.filename}`;
            if(folderName) {
                fileURL = `${req.protocol}://${req.get('host')}/${folderName}/${file.filename}`;
            }
            return {
                "originalName": file.originalname,
                "type": file.mimetype,
                "destination": file.destination,
                "fileName": file.filename,
                "fileUrl": fileURL,
                "filePath": file.path,
                "size": file.size
            }
        });
        return res.status(200).send({ status: true, message: 'Files uploaded successfully', data });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const uploadBaseImageService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { baseImage } = req.body;

    if (!baseImage || typeof baseImage !== "string") {
      return res.status(400).send({
        status: false,
        message: "Base64 image data is required",
        data: null
      });
    }

    let mimeType = "image/png"; // default
    let base64Data: string;

    // If it's in data URI format (data:image/png;base64,...)
    const matches = baseImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      // Treat whole string as base64 without prefix
      base64Data = baseImage;
    }

    const imageBuffer = Buffer.from(base64Data, "base64");
    const extension = mimeType.split("/")[1]; // png, jpg, etc.

    const fileName = `${uuidv4()}.${extension}`;
    const destination = path.join(__dirname, "../../uploadFiles");
    const filePath = path.join(destination, fileName);
    const fileUrl = `${req.protocol}://${req.get("host")}/${fileName}`;

    // Ensure folder exists
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    // Save file
    fs.writeFileSync(filePath, imageBuffer);

    const fileInfo = {
      originalName: fileName,
      type: mimeType,
      destination,
      fileName,
      fileUrl,
      filePath,
      size: imageBuffer.length
    };

    return res.status(200).send({
      status: true,
      message: "File uploaded successfully",
      data: fileInfo
    });

  } catch (err) {
    console.error("Image upload error:", err);
    return res.status(500).send({
      status: false,
      message: "Internal server error during image upload",
      data: null
    });
  }
};