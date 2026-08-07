import fs from 'node:fs';
import path from 'node:path';
import { IStorageProvider, sha256Hex } from '../_config/storage';

export type UploadMigrationStatus = 'planned' | 'migrated' | 'failed';

export interface UploadMigrationEntry {
  relativePath: string;
  size: number;
  checksumSha256: string;
  status: UploadMigrationStatus;
  remotePath?: string;
  error?: string;
}

export interface UploadMigrationReport {
  sourceRoot: string;
  mode: 'dry-run' | 'execute';
  startedAt: string;
  completedAt: string;
  totals: {
    discovered: number;
    planned: number;
    migrated: number;
    failed: number;
  };
  entries: UploadMigrationEntry[];
}

const mimeTypeFor = (fileName: string): string => {
  switch (path.extname(fileName).toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
};

const findFiles = async (directory: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(resolved);
    return entry.isFile() ? [resolved] : [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right));
};

/**
 * Copies local uploads to the configured target and verifies every remote
 * checksum. Source files are never changed or deleted.
 */
export const migrateLocalUploads = async (
  sourceRoot: string,
  target: IStorageProvider,
  execute = false
): Promise<UploadMigrationReport> => {
  const root = path.resolve(sourceRoot);
  const stat = await fs.promises.stat(root);
  if (!stat.isDirectory()) throw new Error(`Upload source is not a directory: ${root}`);

  const startedAt = new Date().toISOString();
  const files = await findFiles(root);
  const entries: UploadMigrationEntry[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const buffer = await fs.promises.readFile(filePath);
    const checksumSha256 = sha256Hex(buffer);
    const entry: UploadMigrationEntry = {
      relativePath,
      size: buffer.length,
      checksumSha256,
      status: execute ? 'failed' : 'planned'
    };

    if (execute) {
      const folder = path.dirname(relativePath) === '.'
        ? undefined
        : path.dirname(relativePath).split(path.sep).join('/');
      const fileName = path.basename(relativePath);
      try {
        const stored = await target.upload(buffer, fileName, mimeTypeFor(fileName), folder);
        const verified = stored.size === buffer.length
          && stored.checksumSha256 === checksumSha256
          && await target.verifyChecksum(fileName, checksumSha256, folder);
        if (!verified) throw new Error('Remote size or SHA-256 verification failed');
        entry.status = 'migrated';
        entry.remotePath = stored.path;
      } catch (error) {
        entry.error = error instanceof Error ? error.message : 'Unknown migration error';
      }
    }
    entries.push(entry);
  }

  return {
    sourceRoot: root,
    mode: execute ? 'execute' : 'dry-run',
    startedAt,
    completedAt: new Date().toISOString(),
    totals: {
      discovered: entries.length,
      planned: entries.filter((entry) => entry.status === 'planned').length,
      migrated: entries.filter((entry) => entry.status === 'migrated').length,
      failed: entries.filter((entry) => entry.status === 'failed').length
    },
    entries
  };
};
