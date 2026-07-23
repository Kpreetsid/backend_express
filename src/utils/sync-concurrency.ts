import { Request, Response } from 'express';

export function getExpectedSyncVersion(req: Request): number | undefined {
  const raw = req.header('If-Match');
  if (!raw) {
    return undefined;
  }
  const normalized = raw.replace(/^W\//i, '').replace(/^"|"$/g, '').trim();
  const version = Number(normalized);
  if (!Number.isInteger(version) || version < 0) {
    throw Object.assign(new Error('If-Match must contain a valid sync version.'), { status: 400 });
  }
  return version;
}

export function assertSyncVersion(current: any, expectedVersion?: number): void {
  if (expectedVersion === undefined) {
    return;
  }
  const currentVersion = Number(current?.sync_version || 0);
  if (currentVersion !== expectedVersion) {
    throw createSyncConflict(current);
  }
}

export function createSyncConflict(latest: any): Error {
  const snapshot = latest?.toObject ? latest.toObject() : latest;
  return Object.assign(new Error('The record changed on the server. Review the latest version before applying your offline change.'), {
    name: 'PreconditionFailedError',
    status: 412,
    data: snapshot
  });
}

export function setSyncVersionEtag(res: Response, value: any): void {
  const candidate = Array.isArray(value) ? value[0] : value;
  const version = candidate?.sync_version;
  if (Number.isInteger(Number(version))) {
    res.setHeader('ETag', `"${Number(version)}"`);
  }
}
