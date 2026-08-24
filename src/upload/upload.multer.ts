import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storageProvider } from "../_config/storage";

const ALLOWED_FOLDERS = new Set([
  'assets',
  'asset_report',
  'endpointImages',
  'floor_map',
  'locations',
  'logo',
  'mailers',
  'observations',
  'posts',
  'user_profile_img',
  'WO_docs',
  'work_request',
  'work_order'
]);

class UploadFilesService {
  private getFormattedDate(): string {
    const iso = new Date().toISOString();
    const [datePart, timePart] = iso.split("T");
    const date = datePart.replace(/-/g, "");
    const time = timePart.replace(/[:.Z]/g, "");
    return `${date}-${time}`;
  }

  generateFileName(extension: any, folderName?: string, companyId?: string): string {
    const timestamp = this.getFormattedDate();
    const randomId = crypto.randomBytes(4).toString("hex");
    const parts: string[] = [timestamp];
    if (folderName) {
      const sanitizedFolder = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
      if (sanitizedFolder) parts.push(sanitizedFolder);
    }
    if (companyId) {
      parts.push(String(companyId).replace(/[^a-zA-Z0-9_-]/g, ""));
    }
    parts.push(randomId);
    let ext = (extension || '').startsWith('.') ? extension : `.${extension}`;
    return `${parts.join("-")}${ext}`;
  }

  getDestinationPath(folderName?: string): string {
    const root = (storageProvider as any).getRootPath ? (storageProvider as any).getRootPath() : path.resolve(__dirname, '../../uploadFiles');
    const cleanFolder = folderName ? folderName.trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
    if (cleanFolder && !ALLOWED_FOLDERS.has(cleanFolder)) {
      throw Object.assign(new Error('Invalid destination folder'), { status: 400 });
    }
    const destination = cleanFolder ? path.join(root, cleanFolder) : root;
    const resolvedRoot = path.resolve(root);
    const resolvedDest = path.resolve(destination);
    if (!resolvedDest.startsWith(resolvedRoot)) {
      throw Object.assign(new Error('Invalid folder path traversal detected'), { status: 400 });
    }
    if (!fs.existsSync(resolvedDest)) {
      fs.mkdirSync(resolvedDest, { recursive: true });
    }
    return resolvedDest;
  }

  async uploadBase64Image(base64Image: string, folderName?: string, accountId?: string) {
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
      const extension = mimeType.split("/")[1];

      const fileName = this.generateFileName(extension, folderName, accountId);
      
      const file = await storageProvider.upload(imageBuffer, fileName, mimeType, folderName);

      return {
        originalName: fileName,
        type: mimeType,
        destination: file.path,
        folderName,
        fileName,
        filePath: file.path,
        fileURL: file.url,
        size: file.size
      };
    } catch (error) {
      console.error("Image upload error:", error);
      throw error;
    }
  };

  async deleteBase64Image(fileName: string, folderName?: string) {
    try {
      await storageProvider.delete(fileName, folderName);
    } catch (error) {
      console.error("Image delete error:", error);
      throw error;
    }
  };
}

export const uploadFilesService = new UploadFilesService();