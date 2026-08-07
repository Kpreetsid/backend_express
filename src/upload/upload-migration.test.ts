import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IStorageProvider, StorageFile, sha256Hex } from '../_config/storage';
import { migrateLocalUploads } from './upload-migration';

const temporaryDirectories: string[] = [];

const createSource = async (): Promise<string> => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cmms-upload-migration-'));
  temporaryDirectories.push(root);
  await fs.promises.mkdir(path.join(root, 'assets'));
  await fs.promises.writeFile(path.join(root, 'root.pdf'), Buffer.from('%PDF-test'));
  await fs.promises.writeFile(
    path.join(root, 'assets', 'photo.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0x01])
  );
  return root;
};

const provider = (): IStorageProvider => ({
  upload: vi.fn(async (buffer, fileName, mimeType, folderName): Promise<StorageFile> => ({
    fileName,
    originalName: fileName,
    mimeType,
    size: buffer.length,
    url: `https://files.example/${folderName ? `${folderName}/` : ''}${fileName}`,
    path: folderName ? `${folderName}/${fileName}` : fileName,
    checksumSha256: sha256Hex(buffer)
  })),
  delete: vi.fn(),
  getURL: vi.fn(),
  exists: vi.fn(async () => true),
  readBuffer: vi.fn(async () => Buffer.alloc(0)),
  verifyChecksum: vi.fn(async () => true)
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.promises.rm(directory, { recursive: true, force: true })
  ));
});

describe('upload migration', () => {
  it('defaults to a non-mutating inventory with stable checksums', async () => {
    const target = provider();
    const report = await migrateLocalUploads(await createSource(), target);

    expect(report.mode).toBe('dry-run');
    expect(report.totals).toEqual({ discovered: 2, planned: 2, migrated: 0, failed: 0 });
    expect(report.entries.map((entry) => entry.relativePath)).toEqual(['assets/photo.jpg', 'root.pdf']);
    expect(report.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.checksumSha256))).toBe(true);
    expect(target.upload).not.toHaveBeenCalled();
  });

  it('uploads and independently verifies every source file without deleting it', async () => {
    const source = await createSource();
    const target = provider();
    const report = await migrateLocalUploads(source, target, true);

    expect(report.totals).toEqual({ discovered: 2, planned: 0, migrated: 2, failed: 0 });
    expect(target.upload).toHaveBeenCalledTimes(2);
    expect(target.verifyChecksum).toHaveBeenCalledTimes(2);
    await expect(fs.promises.stat(path.join(source, 'root.pdf'))).resolves.toBeDefined();
  });

  it('records checksum failures for reconciliation instead of deleting the source', async () => {
    const source = await createSource();
    const target = provider();
    vi.mocked(target.verifyChecksum).mockResolvedValueOnce(false);

    const report = await migrateLocalUploads(source, target, true);

    expect(report.totals.failed).toBe(1);
    expect(report.entries.some((entry) => entry.error?.includes('SHA-256'))).toBe(true);
    await expect(fs.promises.stat(path.join(source, 'assets', 'photo.jpg'))).resolves.toBeDefined();
  });
});
