import { applicationLogger } from '../observability/logger';
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getStorageFolder, getStorageKey, sha256Hex, storageProvider } from "../_config/storage";
import { storageConfig } from "../configDB";
import { assertFileIsClean } from "../_config/malwareScanner";
import { uploadMetadataService } from "./upload-metadata.service";
import { UploadQuotaReservation, uploadQuotaService } from "./upload-quota.service";
import { uploadOperationsCounter } from '../observability/metrics';

class UploadFilesService {
  async persistMultipartFiles(
    files: any[],
    folderName?: string,
    accountId?: string,
    createdBy?: string
  ): Promise<any[]> {
    const persistedFiles: any[] = [];
    try {
      for (const file of files) {
        persistedFiles.push(await this.persistMultipartFile(
          file,
          folderName,
          accountId,
          createdBy
        ));
      }
      return persistedFiles;
    } catch (error) {
      for (const persistedFile of persistedFiles.reverse()) {
        const fileName = persistedFile.filename || persistedFile.fileName;
        if (!fileName) continue;
        try {
          await this.deleteBase64Image(fileName, folderName, accountId, createdBy);
        } catch (cleanupError) {
          applicationLogger.error(
            { err: cleanupError, fileName, folderName, accountId },
            'Failed to roll back a previously persisted multipart file'
          );
        }
      }
      throw error;
    }
  }

  async persistMultipartFile(
    file: any,
    folderName?: string,
    accountId?: string,
    createdBy?: string
  ): Promise<any> {
    const buffer: Buffer = file.buffer || await fs.promises.readFile(file.path);
    const extension = path.extname(file.originalname || file.filename || '').toLowerCase();
    const valid =
      (extension === '.pdf' && buffer.subarray(0, 5).toString() === '%PDF-')
      || (extension === '.png' && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      || (['.jpg', '.jpeg'].includes(extension) && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff);

    if (!valid) {
      if (file.path && fs.existsSync(file.path)) await fs.promises.unlink(file.path);
      uploadOperationsCounter.inc({ result: 'failure' });
      throw Object.assign(new Error('File content does not match the allowed file type'), { status: 400 });
    }
    let reservation: UploadQuotaReservation | null = null;
    let persistedFile: any;
    let storedFileName: string | undefined = storageConfig.driver === 'local'
      ? file.filename
      : undefined;
    let storageWritten = storageConfig.driver === 'local' && !!storedFileName;
    try {
      await assertFileIsClean(buffer, file.originalname || file.filename, file.mimetype);
      reservation = accountId ? await uploadQuotaService.reserve(accountId, buffer.length) : null;

      if (storageConfig.driver === 's3') {
        const fileName = this.generateFileName(extension, folderName, accountId);
        const stored = await storageProvider.upload(buffer, fileName, file.mimetype, folderName);
        storedFileName = stored.fileName;
        storageWritten = true;
        persistedFile = {
          ...file,
          filename: stored.fileName,
          fileName: stored.fileName,
          destination: folderName || '',
          path: stored.path,
          filePath: stored.path,
          size: stored.size,
          checksumSha256: stored.checksumSha256,
          storageDriver: 's3'
        };
      } else {
        persistedFile = Object.assign(file, {
          fileName: file.filename,
          filePath: file.path,
          checksumSha256: sha256Hex(buffer),
          storageDriver: 'local'
        });
      }

      if (accountId) {
        await uploadMetadataService.recordUpload({
          accountId,
          ...(createdBy ? { createdBy } : {}),
          originalName: persistedFile.originalname || persistedFile.originalName || persistedFile.filename,
          fileName: persistedFile.filename || persistedFile.fileName,
          ...(folderName ? { folderName } : {}),
          mimeType: persistedFile.mimetype || persistedFile.type,
          size: persistedFile.size ?? buffer.length,
          checksumSha256: persistedFile.checksumSha256,
          storageDriver: persistedFile.storageDriver
        });
      }
      if (reservation) {
        await uploadQuotaService.commit(
          reservation,
          getStorageKey(persistedFile.filename || persistedFile.fileName, folderName)
        );
      }
      uploadOperationsCounter.inc({ result: 'success' });
      return persistedFile;
    } catch (error) {
      if (storageWritten && storedFileName) {
        await storageProvider.delete(storedFileName, folderName);
      }
      await uploadQuotaService.release(reservation);
      uploadOperationsCounter.inc({ result: 'failure' });
      throw error;
    }
  }

  private getFormattedDate(): string {
    const iso = new Date().toISOString();
    const [datePart = "", timePart = ""] = iso.split("T");
    const date = datePart.replace(/-/g, "");
    const time = timePart.replace(/[:.Z]/g, "");
    return `${date}-${time}`;
  }

  generateFileName(extension: any, folderName?: string, companyId?: string): string {
    const timestamp = this.getFormattedDate();
    const randomId = crypto.randomBytes(4).toString("hex");
    const parts: string[] = [timestamp];
    if (folderName) {
      parts.push(folderName.trim().replace(/\s+/g, "-").toLowerCase());
    }
    if (companyId) {
      parts.push(String(companyId));
    }
    parts.push(randomId);
    let ext = (extension || '').startsWith('.') ? extension : `.${extension}`;
    return `${parts.join("-")}${ext}`;
  }

  getDestinationPath(folderName?: string): string {
    const root = (storageProvider as any).getRootPath ? (storageProvider as any).getRootPath() : path.resolve(__dirname, '../../uploadFiles');
    const safeFolder = getStorageFolder(folderName);
    const destination = safeFolder ? path.join(root, ...safeFolder.split('/')) : root;
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    return destination;
  }

  async uploadBase64Image(
    base64Image: string,
    folderName?: string,
    accountId?: string,
    createdBy?: string
  ) {
    try {
      if (!base64Image || typeof base64Image !== "string") {
        uploadOperationsCounter.inc({ result: 'failure' });
        throw Object.assign(new Error('Base64 image data is required'), { status: 400 });
      }

      let mimeType = "image/png";
      let base64Data: string;
      const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1]!;
        base64Data = matches[2]!;
      } else {
        base64Data = base64Image;
      }

      const imageBuffer = Buffer.from(base64Data, "base64");
      if (imageBuffer.length === 0 || imageBuffer.length > 5 * 1024 * 1024) {
        uploadOperationsCounter.inc({ result: 'failure' });
        throw Object.assign(new Error('Image must be between 1 byte and 5 MB'), { status: 400 });
      }
      const isPng = imageBuffer.subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isJpeg = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff;
      if ((mimeType === 'image/png' && !isPng) || (['image/jpeg', 'image/jpg'].includes(mimeType) && !isJpeg)) {
        uploadOperationsCounter.inc({ result: 'failure' });
        throw Object.assign(new Error('Image content does not match its declared type'), { status: 400 });
      }
      let reservation: UploadQuotaReservation | null = null;
      let fileName: string | undefined;
      let storageWritten = false;
      try {
        await assertFileIsClean(imageBuffer, 'base64-image', mimeType);
        reservation = accountId
          ? await uploadQuotaService.reserve(accountId, imageBuffer.length)
          : null;
        const extension = mimeType.split("/")[1];
        fileName = this.generateFileName(extension, folderName, accountId);
        const file = await storageProvider.upload(imageBuffer, fileName, mimeType, folderName);
        storageWritten = true;
        if (accountId) {
          await uploadMetadataService.recordUpload({
            accountId,
            ...(createdBy ? { createdBy } : {}),
            originalName: fileName,
            fileName,
            ...(folderName ? { folderName } : {}),
            mimeType,
            size: file.size,
            checksumSha256: file.checksumSha256,
            storageDriver: storageConfig.driver
          });
        }
        if (reservation) {
          await uploadQuotaService.commit(reservation, getStorageKey(fileName, folderName));
        }
        uploadOperationsCounter.inc({ result: 'success' });
        return {
          originalName: fileName,
          type: mimeType,
          destination: file.path,
          folderName,
          fileName,
          filePath: file.path,
          fileURL: file.url,
          size: file.size,
          checksumSha256: file.checksumSha256,
          storageDriver: storageConfig.driver
        };
      } catch (error) {
        if (storageWritten && fileName) await storageProvider.delete(fileName, folderName);
        await uploadQuotaService.release(reservation);
        uploadOperationsCounter.inc({ result: 'failure' });
        throw error;
      }
    } catch (error) {
      applicationLogger.error({ err: error }, "Image upload error:");
      throw error;
    }
  };

  async deleteBase64Image(
    fileName: string,
    folderName?: string,
    accountId?: string,
    deletedBy?: string
  ) {
    try {
      if (accountId) {
        await uploadMetadataService.assertTenantOwnership(accountId, fileName, folderName);
      }
      await storageProvider.delete(fileName, folderName);
      if (accountId) {
        const deletedBytes = await uploadMetadataService.markDeleted(
          accountId,
          fileName,
          folderName,
          deletedBy
        );
        await uploadQuotaService.releaseActive(accountId, deletedBytes);
      }
    } catch (error) {
      applicationLogger.error({ err: error }, "Image delete error:");
      throw error;
    }
  };
}

export const uploadFilesService = new UploadFilesService();
