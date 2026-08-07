import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { storageConfig } from '../configDB';
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  checksumSha256: string;
}

export interface IStorageProvider {
  upload(buffer: Buffer, fileName: string, mimeType: string, folderName?: string): Promise<StorageFile>;
  delete(fileName: string, folderName?: string): Promise<void>;
  getURL(fileName: string, folderName?: string): string;
  exists(fileName: string, folderName?: string): Promise<boolean>;
  readBuffer(fileName: string, folderName?: string): Promise<Buffer>;
  verifyChecksum(fileName: string, checksumSha256: string, folderName?: string): Promise<boolean>;
  getSignedURL?(fileName: string, folderName?: string): Promise<string>;
  healthCheck?(): Promise<boolean>;
}

export const sha256Hex = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

const sha256Base64 = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('base64');

export const getStorageFolder = (folderName?: string): string =>
  (folderName || '')
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');

export const getStorageKey = (fileName: string, folderName?: string): string => {
  const safeFileName = path.basename(fileName);
  const safeFolder = getStorageFolder(folderName);
  return safeFolder ? `${safeFolder}/${safeFileName}` : safeFileName;
};

export class LocalDiskStorageProvider implements IStorageProvider {
  constructor(
    private readonly uploadRoot = path.resolve(__dirname, '../../uploadFiles'),
    private readonly baseUrl = storageConfig.baseUrl
  ) {}

  private ensureDirectory(folderName?: string) {
    const safeFolder = getStorageFolder(folderName);
    const target = safeFolder ? path.join(this.uploadRoot, ...safeFolder.split('/')) : this.uploadRoot;
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  }

  private filePath(fileName: string, folderName?: string): string {
    const safeFolder = getStorageFolder(folderName);
    return path.join(
      this.uploadRoot,
      ...(safeFolder ? safeFolder.split('/') : []),
      path.basename(fileName)
    );
  }

  async upload(buffer: Buffer, fileName: string, mimeType: string, folderName?: string): Promise<StorageFile> {
    const dest = this.ensureDirectory(folderName);
    const filePath = path.join(dest, path.basename(fileName));
    fs.writeFileSync(filePath, buffer);

    return {
      fileName,
      originalName: fileName,
      mimeType,
      size: buffer.length,
      path: filePath,
      url: this.getURL(fileName, folderName),
      checksumSha256: sha256Hex(buffer)
    };
  }

  public getRootPath(): string {
    return this.uploadRoot;
  }

  async delete(fileName: string, folderName?: string): Promise<void> {
    const filePath = this.filePath(fileName, folderName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getURL(fileName: string, folderName?: string): string {
    const urlPath = getStorageKey(fileName, folderName);
    return `${this.baseUrl.replace(/\/$/, '')}/${urlPath}`;
  }

  async exists(fileName: string, folderName?: string): Promise<boolean> {
    return fs.existsSync(this.filePath(fileName, folderName));
  }

  async readBuffer(fileName: string, folderName?: string): Promise<Buffer> {
    return fs.promises.readFile(this.filePath(fileName, folderName));
  }

  async verifyChecksum(fileName: string, checksumSha256: string, folderName?: string): Promise<boolean> {
    const filePath = this.filePath(fileName, folderName);
    if (!fs.existsSync(filePath)) return false;
    return sha256Hex(await fs.promises.readFile(filePath)) === checksumSha256;
  }
}

export class S3StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(client?: S3Client) {
    if (!storageConfig.bucket || !storageConfig.region) {
      throw new Error('S3_BUCKET and S3_REGION are required for the s3 storage driver');
    }
    this.bucket = storageConfig.bucket;
    this.client = client || new S3Client({
      region: storageConfig.region,
      forcePathStyle: storageConfig.forcePathStyle,
      ...(storageConfig.endpoint ? { endpoint: storageConfig.endpoint } : {})
    });
  }

  async upload(buffer: Buffer, fileName: string, mimeType: string, folderName?: string): Promise<StorageFile> {
    const key = getStorageKey(fileName, folderName);
    const expectedChecksum = sha256Base64(buffer);
    const result = await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ChecksumSHA256: expectedChecksum,
      ServerSideEncryption: 'AES256'
    }));
    if (result.ChecksumSHA256 && result.ChecksumSHA256 !== expectedChecksum) {
      throw new Error(`S3 checksum mismatch for ${key}`);
    }
    return {
      fileName: path.basename(fileName),
      originalName: fileName,
      mimeType,
      size: buffer.length,
      path: key,
      url: this.getURL(fileName, folderName),
      checksumSha256: sha256Hex(buffer)
    };
  }

  async delete(fileName: string, folderName?: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: getStorageKey(fileName, folderName)
    }));
  }

  getURL(fileName: string, folderName?: string): string {
    const key = getStorageKey(fileName, folderName)
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    return `${storageConfig.baseUrl.replace(/\/$/, '')}/${key}`;
  }

  async getSignedURL(fileName: string, folderName?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: getStorageKey(fileName, folderName) }),
      { expiresIn: storageConfig.signedUrlTtlSeconds }
    );
  }

  async exists(fileName: string, folderName?: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: getStorageKey(fileName, folderName)
      }));
      return true;
    } catch {
      return false;
    }
  }

  async readBuffer(fileName: string, folderName?: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: getStorageKey(fileName, folderName)
    }));
    if (!result.Body) throw new Error(`S3 object body is empty for ${getStorageKey(fileName, folderName)}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async verifyChecksum(fileName: string, checksumSha256: string, folderName?: string): Promise<boolean> {
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: getStorageKey(fileName, folderName),
        ChecksumMode: 'ENABLED'
      }));
      return result.ChecksumSHA256 === Buffer.from(checksumSha256, 'hex').toString('base64');
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

export class DualReadStorageProvider implements IStorageProvider {
  constructor(
    private readonly primary: IStorageProvider,
    private readonly fallback: IStorageProvider
  ) {}

  upload(buffer: Buffer, fileName: string, mimeType: string, folderName?: string): Promise<StorageFile> {
    return this.primary.upload(buffer, fileName, mimeType, folderName);
  }

  delete(fileName: string, folderName?: string): Promise<void> {
    // The legacy source remains immutable until migration reconciliation is approved.
    return this.primary.delete(fileName, folderName);
  }

  getURL(fileName: string, folderName?: string): string {
    return this.primary.getURL(fileName, folderName);
  }

  async getSignedURL(fileName: string, folderName?: string): Promise<string> {
    if (await this.primary.exists(fileName, folderName)) {
      return this.resolveReadURL(this.primary, fileName, folderName);
    }
    if (await this.fallback.exists(fileName, folderName)) {
      return this.resolveReadURL(this.fallback, fileName, folderName);
    }
    // Preserve the historical behavior of returning the configured primary URL;
    // the storage service remains authoritative for the eventual 404.
    return this.resolveReadURL(this.primary, fileName, folderName);
  }

  async exists(fileName: string, folderName?: string): Promise<boolean> {
    return await this.primary.exists(fileName, folderName)
      || await this.fallback.exists(fileName, folderName);
  }

  async readBuffer(fileName: string, folderName?: string): Promise<Buffer> {
    if (await this.primary.exists(fileName, folderName)) {
      return this.primary.readBuffer(fileName, folderName);
    }
    if (await this.fallback.exists(fileName, folderName)) {
      return this.fallback.readBuffer(fileName, folderName);
    }
    return this.primary.readBuffer(fileName, folderName);
  }

  verifyChecksum(fileName: string, checksumSha256: string, folderName?: string): Promise<boolean> {
    return this.primary.verifyChecksum(fileName, checksumSha256, folderName);
  }

  healthCheck(): Promise<boolean> {
    return this.primary.healthCheck ? this.primary.healthCheck() : Promise.resolve(true);
  }

  private resolveReadURL(provider: IStorageProvider, fileName: string, folderName?: string): Promise<string> {
    return provider.getSignedURL
      ? provider.getSignedURL(fileName, folderName)
      : Promise.resolve(provider.getURL(fileName, folderName));
  }
}

export const createStorageProvider = (): IStorageProvider => {
  if (storageConfig.driver !== 's3') return new LocalDiskStorageProvider();
  const s3 = new S3StorageProvider();
  return storageConfig.dualReadLocalFallbackEnabled
    ? new DualReadStorageProvider(
      s3,
      new LocalDiskStorageProvider(
        path.resolve(__dirname, '../../uploadFiles'),
        storageConfig.dualReadLocalBaseUrl || storageConfig.baseUrl
      )
    )
    : s3;
};

export const storageProvider: IStorageProvider = createStorageProvider();
