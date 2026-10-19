import path from 'node:path';

/**
 * UploadFilesService generates this filename from the authenticated account.
 * A client-supplied attachment record or account substring is not ownership proof.
 * Older filenames must be migrated with verified ownership before being served.
 */
export function getUploadAccountId(filePath: string): string | null {
  if (typeof filePath !== 'string') return null;
  const filename = path.basename(filePath);
  const match = /^\d{8}-\d{9}-(?:[a-zA-Z0-9_-]+-)?([a-fA-F0-9]{24})-[a-fA-F0-9]{8}\.[a-zA-Z0-9]+$/.exec(filename);
  return match ? match[1].toLowerCase() : null;
}

export function isUploadOwnedBy(filePath: string, accountId: unknown): boolean {
  const account = String(accountId ?? '').toLowerCase();
  return /^[a-f0-9]{24}$/.test(account) && getUploadAccountId(filePath) === account;
}
