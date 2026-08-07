import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../configDB';
import {
  DualReadStorageProvider,
  IStorageProvider,
  LocalDiskStorageProvider,
  S3StorageProvider,
  createStorageProvider,
  sha256Hex,
  StorageFile
} from './storage';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn()
}));

const temporaryDirectories: string[] = [];
const originalStorageConfig = { ...storageConfig };

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.promises.rm(directory, { recursive: true, force: true })
  ));
  Object.assign(storageConfig, originalStorageConfig);
});

const s3Provider = (send: ReturnType<typeof vi.fn>): S3StorageProvider => {
  Object.assign(storageConfig, {
    bucket: 'cmms-private',
    region: 'ap-south-1',
    baseUrl: 'https://files.example/',
    signedUrlTtlSeconds: 120
  });
  return new S3StorageProvider({ send } as unknown as S3Client);
};

const provider = (name: string, present: boolean): IStorageProvider => ({
  upload: vi.fn(async (buffer, fileName, mimeType, folderName): Promise<StorageFile> => ({
    fileName,
    originalName: fileName,
    mimeType,
    size: buffer.length,
    url: `${name}://${folderName || ''}/${fileName}`,
    path: `${folderName || ''}/${fileName}`,
    checksumSha256: '0'.repeat(64)
  })),
  delete: vi.fn(async () => undefined),
  getURL: vi.fn((fileName, folderName) => `${name}://${folderName || ''}/${fileName}`),
  getSignedURL: vi.fn(async (fileName, folderName) => `${name}-signed://${folderName || ''}/${fileName}`),
  exists: vi.fn(async () => present),
  readBuffer: vi.fn(async () => Buffer.from(name)),
  verifyChecksum: vi.fn(async () => true),
  healthCheck: vi.fn(async () => true)
});

describe('S3 dual-read storage cutover', () => {
  it('reads from S3 when the primary object exists', async () => {
    const primary = provider('s3', true);
    const fallback = provider('local', true);
    const dual = new DualReadStorageProvider(primary, fallback);

    await expect(dual.getSignedURL('manual.pdf', 'docs'))
      .resolves.toBe('s3-signed://docs/manual.pdf');
    expect(fallback.exists).not.toHaveBeenCalled();
  });

  it('falls back to the legacy local source only when S3 is missing the object', async () => {
    const primary = provider('s3', false);
    const fallback = provider('local', true);
    const dual = new DualReadStorageProvider(primary, fallback);

    await expect(dual.getSignedURL('manual.pdf', 'docs'))
      .resolves.toBe('local-signed://docs/manual.pdf');
    await expect(dual.exists('manual.pdf', 'docs')).resolves.toBe(true);
    await expect(dual.readBuffer('manual.pdf', 'docs')).resolves.toEqual(Buffer.from('local'));
    expect(primary.readBuffer).not.toHaveBeenCalled();
    expect(fallback.readBuffer).toHaveBeenCalledWith('manual.pdf', 'docs');
  });

  it('keeps writes, checksum verification, deletion, and health on S3', async () => {
    const primary = provider('s3', true);
    const fallback = provider('local', true);
    const dual = new DualReadStorageProvider(primary, fallback);
    const buffer = Buffer.from('file');

    await dual.upload(buffer, 'manual.pdf', 'application/pdf', 'docs');
    await dual.verifyChecksum('manual.pdf', '0'.repeat(64), 'docs');
    await dual.delete('manual.pdf', 'docs');
    await dual.healthCheck();

    expect(primary.upload).toHaveBeenCalled();
    expect(primary.verifyChecksum).toHaveBeenCalled();
    expect(primary.delete).toHaveBeenCalled();
    expect(primary.healthCheck).toHaveBeenCalled();
    expect(fallback.upload).not.toHaveBeenCalled();
    expect(fallback.delete).not.toHaveBeenCalled();
  });

  it('uses primary read behavior when objects exist or neither provider has the object', async () => {
    const primary = provider('s3', true);
    const fallback = provider('local', false);
    const dual = new DualReadStorageProvider(primary, fallback);

    expect(dual.getURL('manual.pdf', 'docs')).toBe('s3://docs/manual.pdf');
    await expect(dual.readBuffer('manual.pdf', 'docs')).resolves.toEqual(Buffer.from('s3'));

    vi.mocked(primary.exists).mockResolvedValue(false);
    await expect(dual.getSignedURL('missing.pdf', 'docs'))
      .resolves.toBe('s3-signed://docs/missing.pdf');
    await expect(dual.readBuffer('missing.pdf', 'docs')).resolves.toEqual(Buffer.from('s3'));
  });

  it('supports unsigned fallback URLs and a primary without a health probe', async () => {
    const primary = provider('s3', false);
    const fallback = provider('local', true);
    delete primary.healthCheck;
    delete fallback.getSignedURL;
    const dual = new DualReadStorageProvider(primary, fallback);

    await expect(dual.getSignedURL('manual.pdf', 'docs'))
      .resolves.toBe('local://docs/manual.pdf');
    await expect(dual.healthCheck()).resolves.toBe(true);
  });
});

describe('local storage path containment', () => {
  it('normalizes untrusted folder and file segments inside the configured root', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cmms-local-storage-'));
    temporaryDirectories.push(root);
    const local = new LocalDiskStorageProvider(root, 'https://api.example');

    const stored = await local.upload(
      Buffer.from('safe'),
      '../manual.pdf',
      'application/pdf',
      '../../documents'
    );

    expect(stored.path).toBe(path.join(root, 'documents', 'manual.pdf'));
    expect(stored.url).toBe('https://api.example/documents/manual.pdf');
    await expect(local.exists('../manual.pdf', '../../documents')).resolves.toBe(true);
    await expect(local.readBuffer('../manual.pdf', '../../documents')).resolves.toEqual(Buffer.from('safe'));
    await expect(local.verifyChecksum('../manual.pdf', stored.checksumSha256, '../../documents'))
      .resolves.toBe(true);
    await local.delete('../manual.pdf', '../../documents');
    await expect(local.exists('manual.pdf', 'documents')).resolves.toBe(false);
  });

  it('handles absent files and encodes checksums deterministically', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cmms-local-storage-'));
    temporaryDirectories.push(root);
    const local = new LocalDiskStorageProvider(root, 'https://api.example/');

    expect(local.getRootPath()).toBe(root);
    expect(local.getURL('manual.pdf', 'documents')).toBe('https://api.example/documents/manual.pdf');
    expect(sha256Hex(Buffer.from('safe'))).toHaveLength(64);
    await expect(local.verifyChecksum('missing.pdf', '0'.repeat(64), 'documents'))
      .resolves.toBe(false);
    await expect(local.delete('missing.pdf', 'documents')).resolves.toBeUndefined();
  });
});

describe('S3 storage provider', () => {
  it('fails closed when required S3 configuration is missing', () => {
    Object.assign(storageConfig, { bucket: '', region: '' });

    expect(() => new S3StorageProvider()).toThrow(
      'S3_BUCKET and S3_REGION are required for the s3 storage driver'
    );
  });

  it('uploads encrypted objects with a server-verified checksum', async () => {
    const send = vi.fn(async (command) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      return { ChecksumSHA256: command.input.ChecksumSHA256 };
    });
    const s3 = s3Provider(send);
    const buffer = Buffer.from('manual');

    await expect(s3.upload(buffer, '../manual one.pdf', 'application/pdf', '../tenant/docs'))
      .resolves.toEqual(expect.objectContaining({
        fileName: 'manual one.pdf',
        originalName: '../manual one.pdf',
        mimeType: 'application/pdf',
        size: buffer.length,
        path: 'tenant/docs/manual one.pdf',
        url: 'https://files.example/tenant/docs/manual%20one.pdf',
        checksumSha256: sha256Hex(buffer)
      }));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].input).toEqual(expect.objectContaining({
      Bucket: 'cmms-private',
      Key: 'tenant/docs/manual one.pdf',
      Body: buffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256'
    }));
  });

  it('rejects a checksum returned by S3 that does not match the upload', async () => {
    const s3 = s3Provider(vi.fn(async () => ({ ChecksumSHA256: 'unexpected' })));

    await expect(s3.upload(Buffer.from('manual'), 'manual.pdf', 'application/pdf'))
      .rejects.toThrow('S3 checksum mismatch for manual.pdf');
  });

  it('accepts compatible S3 endpoints that omit a response checksum', async () => {
    const s3 = s3Provider(vi.fn(async () => ({})));

    await expect(s3.upload(Buffer.from('manual'), 'manual.pdf', 'application/pdf'))
      .resolves.toEqual(expect.objectContaining({ fileName: 'manual.pdf' }));
  });

  it('deletes objects and creates bounded signed download URLs', async () => {
    const send = vi.fn(async (_command: { input: Record<string, unknown> }) => ({}));
    const s3 = s3Provider(send);
    vi.mocked(getSignedUrl).mockResolvedValueOnce('https://signed.example/manual.pdf');

    await expect(s3.delete('manual.pdf', 'tenant')).resolves.toBeUndefined();
    expect(send.mock.calls[0]![0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0]![0].input).toEqual({
      Bucket: 'cmms-private',
      Key: 'tenant/manual.pdf'
    });
    await expect(s3.getSignedURL('manual.pdf', 'tenant'))
      .resolves.toBe('https://signed.example/manual.pdf');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: { Bucket: 'cmms-private', Key: 'tenant/manual.pdf' }
      }),
      { expiresIn: 120 }
    );
  });

  it('checks object existence without leaking storage errors', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('S3 unavailable'));
    const s3 = s3Provider(send);

    await expect(s3.exists('present.pdf')).resolves.toBe(true);
    await expect(s3.exists('missing.pdf')).resolves.toBe(false);
    expect(send.mock.calls[0]![0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('reads object bodies and rejects empty S3 responses', async () => {
    const transformToByteArray = vi.fn(async () => Uint8Array.from(Buffer.from('manual')));
    const send = vi.fn()
      .mockResolvedValueOnce({ Body: { transformToByteArray } })
      .mockResolvedValueOnce({});
    const s3 = s3Provider(send);

    await expect(s3.readBuffer('manual.pdf', 'tenant')).resolves.toEqual(Buffer.from('manual'));
    expect(send.mock.calls[0]![0]).toBeInstanceOf(GetObjectCommand);
    await expect(s3.readBuffer('empty.pdf', 'tenant'))
      .rejects.toThrow('S3 object body is empty for tenant/empty.pdf');
  });

  it('verifies remote checksums and treats lookup failures as mismatches', async () => {
    const expected = sha256Hex(Buffer.from('manual'));
    const expectedBase64 = Buffer.from(expected, 'hex').toString('base64');
    const send = vi.fn()
      .mockResolvedValueOnce({ ChecksumSHA256: expectedBase64 })
      .mockResolvedValueOnce({ ChecksumSHA256: 'different' })
      .mockRejectedValueOnce(new Error('S3 unavailable'));
    const s3 = s3Provider(send);

    await expect(s3.verifyChecksum('manual.pdf', expected)).resolves.toBe(true);
    await expect(s3.verifyChecksum('manual.pdf', expected)).resolves.toBe(false);
    await expect(s3.verifyChecksum('manual.pdf', expected)).resolves.toBe(false);
    expect(send.mock.calls[0]![0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[0]![0].input.ChecksumMode).toBe('ENABLED');
  });

  it('reports bucket readiness without throwing dependency details', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('S3 unavailable'));
    const s3 = s3Provider(send);

    await expect(s3.healthCheck()).resolves.toBe(true);
    await expect(s3.healthCheck()).resolves.toBe(false);
    expect(send.mock.calls[0]![0]).toBeInstanceOf(HeadBucketCommand);
  });
});

describe('storage provider factory', () => {
  it('selects local, S3, and dual-read providers from centralized configuration', () => {
    Object.assign(storageConfig, { driver: 'local' });
    expect(createStorageProvider()).toBeInstanceOf(LocalDiskStorageProvider);

    Object.assign(storageConfig, {
      driver: 's3',
      bucket: 'cmms-private',
      region: 'ap-south-1',
      dualReadLocalFallbackEnabled: false
    });
    expect(createStorageProvider()).toBeInstanceOf(S3StorageProvider);

    Object.assign(storageConfig, { dualReadLocalFallbackEnabled: true });
    expect(createStorageProvider()).toBeInstanceOf(DualReadStorageProvider);
  });
});
