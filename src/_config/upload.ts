import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { UploadModel } from '../models/upload.model';

export const uploadBase64Image = async (base64Image: string, folderName?: string) => {
  try {
    if (!base64Image || typeof base64Image !== "string") {
      throw Object.assign(new Error('Base64 image data is required'), { status: 400 });
    }

    let mimeType = "image/png";
    let base64Data: string;
    const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      base64Data = base64Image;
    }

    const imageBuffer = Buffer.from(base64Data, "base64");
    const extension = mimeType.split("/")[1]; // png, jpg, etc.

    const fileName = `${uuidv4()}.${extension}`;
    let pathName = `../../uploadFiles`;
    if (folderName) {
      pathName = `../../uploadFiles/${folderName}`;
    }
    const destination = path.join(__dirname, pathName);
    const filePath = path.join(destination, fileName);

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    fs.writeFileSync(filePath, imageBuffer);

    return new UploadModel({
      originalName: fileName,
      type: mimeType,
      destination,
      fileName,
      filePath,
      size: imageBuffer.length
    });
  } catch (error) {
    console.error("Image upload error:", error);
    throw error;
  }
};

export const deleteBase64Image = async (fileName: string, folderName?:  string) => {
  try {
    let pathName = `../../uploadFiles`;
    if (folderName) {
      pathName = `../../uploadFiles/${folderName}`;
    }
    const filePath = path.join(__dirname, pathName, fileName);
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Image delete error:", error);
    throw error;
  }
};