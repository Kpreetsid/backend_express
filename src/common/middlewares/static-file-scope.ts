import path from 'path';

const safeAccountId = (accountId: unknown): string =>
  String(accountId || '').replace(/[^a-zA-Z0-9_-]/g, '');

export const isStaticFileOwnedByAccount = (relativePath: string, accountId: unknown): boolean => {
  const account = safeAccountId(accountId);
  if (!account) return false;

  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('../') || normalized.startsWith('../')) return false;

  const fileName = path.posix.basename(normalized);
  return fileName.includes(`-${account}-`);
};
