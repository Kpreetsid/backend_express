import fs from 'fs';
import path from 'path';
import { storageConfig } from '../configDB';

export interface StorageFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
}

export interface IStorageProvider {
  upload(buffer: Buffer, fileName: string, mimeType: string, folderName?: string): Promise<StorageFile>;
  delete(fileName: string, folderName?: string): Promise<void>;
  getURL(fileName: string, folderName?: string): string;
}

export class LocalDiskStorageProvider implements IStorageProvider {
  private uploadRoot = path.resolve(__dirname, '../../uploadFiles');

  private ensureDirectory(folderName?: string) {
    const target = folderName ? path.join(this.uploadRoot, folderName) : this.uploadRoot;
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  }

  async upload(buffer: Buffer, fileName: string, mimeType: string, folderName?: string): Promise<StorageFile> {
    const dest = this.ensureDirectory(folderName);
    const filePath = path.join(dest, fileName);
    fs.writeFileSync(filePath, buffer);

    return {
      fileName,
      originalName: fileName,
      mimeType,
      size: buffer.length,
      path: filePath,
      url: this.getURL(fileName, folderName)
    };
  }

  public getRootPath(): string {
    return this.uploadRoot;
  }

  async delete(fileName: string, folderName?: string): Promise<void> {
    const dest = this.ensureDirectory(folderName);
    const filePath = path.join(dest, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getURL(fileName: string, folderName?: string): string {
    const urlPath = folderName ? `${folderName}/${fileName}` : fileName;
    return `${storageConfig.baseUrl}/${urlPath}`;
  }
}

export const storageProvider: IStorageProvider = new LocalDiskStorageProvider();
