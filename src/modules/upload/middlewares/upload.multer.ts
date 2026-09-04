import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storageProvider } from "../../../core/config/storage.config";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png'
});

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

  normalizeFolderName(folderName?: string): string | undefined {
    if (!folderName) return undefined;
    const cleanFolder = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanFolder || !ALLOWED_FOLDERS.has(cleanFolder)) {
      throw Object.assign(new Error('Invalid destination folder'), { status: 400 });
    }
    return cleanFolder;
  }

  validateFileMetadata(originalName: string, mimeType: string, folderName?: string): string {
    const extension = path.extname(originalName).toLowerCase();
    const expectedMimeType = MIME_BY_EXTENSION[extension];
    const normalizedMimeType = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
    const cleanFolder = this.normalizeFolderName(folderName);

    if (!expectedMimeType || normalizedMimeType !== expectedMimeType) {
      throw Object.assign(new Error('Only PNG, JPEG, and PDF files with matching content types are allowed'), { status: 415 });
    }
    if (cleanFolder === 'user_profile_img' && expectedMimeType === 'application/pdf') {
      throw Object.assign(new Error('Profile images must be PNG or JPEG files'), { status: 415 });
    }
    return expectedMimeType;
  }

  detectFileMimeType(buffer: Buffer): string | undefined {
    if (buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return 'application/pdf';
    }
    return undefined;
  }

  validateFileBuffer(buffer: Buffer, expectedMimeType: string): void {
    if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
      throw Object.assign(new Error('File must be non-empty and no larger than 5MB'), { status: 400 });
    }
    if (this.detectFileMimeType(buffer) !== expectedMimeType) {
      throw Object.assign(new Error('File content does not match its declared type'), { status: 415 });
    }
  }

  async validateStoredUploads(files: Express.Multer.File[], folderName?: string): Promise<void> {
    try {
      if (folderName === 'user_profile_img' && files.length !== 1) {
        throw Object.assign(new Error('Upload exactly one profile image'), { status: 400 });
      }
      for (const file of files) {
        const expectedMimeType = this.validateFileMetadata(file.originalname, file.mimetype, folderName);
        const buffer = await fs.promises.readFile(file.path);
        this.validateFileBuffer(buffer, expectedMimeType);
      }
    } catch (error) {
      await this.cleanupStoredUploads(files);
      throw error;
    }
  }

  async cleanupStoredUploads(files: Express.Multer.File[]): Promise<void> {
    await Promise.allSettled(files
      .filter(file => Boolean(file.path))
      .map(file => fs.promises.unlink(file.path)));
  }

  getDestinationPath(folderName?: string): string {
    const root = (storageProvider as any).getRootPath ? (storageProvider as any).getRootPath() : path.resolve(__dirname, '../../uploadFiles');
    const cleanFolder = this.normalizeFolderName(folderName) || '';
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

      const cleanFolder = this.normalizeFolderName(folderName);
      let declaredMimeType: string | undefined;
      let base64Data: string;
      const matches = base64Image.match(/^data:(image\/(?:png|jpe?g));base64,(.+)$/i);
      if (matches) {
        declaredMimeType = matches[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : matches[1].toLowerCase();
        base64Data = matches[2];
      } else {
        base64Data = base64Image;
      }

      const normalizedBase64 = base64Data.replace(/\s/g, '');
      if (!normalizedBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)) {
        throw Object.assign(new Error('Invalid base64 image data'), { status: 400 });
      }
      const imageBuffer = Buffer.from(normalizedBase64, "base64");
      const mimeType = this.detectFileMimeType(imageBuffer);
      if (!mimeType || mimeType === 'application/pdf' || (declaredMimeType && mimeType !== declaredMimeType)) {
        throw Object.assign(new Error('Image content does not match its declared type'), { status: 415 });
      }
      this.validateFileBuffer(imageBuffer, mimeType);
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

      const fileName = this.generateFileName(extension, cleanFolder, accountId);

      const file = await storageProvider.upload(imageBuffer, fileName, mimeType, cleanFolder);

      return {
        originalName: fileName,
        type: mimeType,
        destination: file.path,
        folderName: cleanFolder,
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
