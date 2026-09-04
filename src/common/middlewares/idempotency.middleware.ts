import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { get } from 'lodash';
import { IdempotencyRecordModel } from '../../modules/settings/models/idempotency-record.model';
import { IUser } from '../../modules/users/models/user.model';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const method = req.method.toUpperCase();
  const key = String(req.header('Idempotency-Key') || '').trim();
  if (!key || !['POST', 'PUT', 'PATCH'].includes(method)) {
    next();
    return;
  }
  if (key.length > 128) {
    next(Object.assign(new Error('Idempotency-Key is too long.'), { status: 400 }));
    return;
  }

  const user = get(req, 'user', {}) as IUser;
  const accountId = String(user.account_id || '');
  const userId = String(user._id || '');
  if (!accountId || !userId) {
    next(Object.assign(new Error('Authentication context is required for idempotent requests.'), { status: 401 }));
    return;
  }

  const requestHash = createHash('sha256')
    .update(`${method}\n${req.originalUrl}\n${stableStringify(req.body || {})}`)
    .digest('hex');
  const identity = { account_id: accountId, user_id: userId, key };

  try {
    const existing = await IdempotencyRecordModel.findOne(identity).lean();
    if (existing) {
      if (existing.request_hash !== requestHash) {
        next(Object.assign(new Error('This Idempotency-Key was already used for a different request.'), { status: 409 }));
        return;
      }
      if (existing.state === 'completed') {
        Object.entries(existing.response_headers || {}).forEach(([name, value]) => res.setHeader(name, value));
        res.setHeader('Idempotency-Replayed', 'true');
        res.status(existing.response_status || 200).json(existing.response_body);
        return;
      }
      const leaseExpired = new Date(existing.expiresAt).getTime() <= Date.now();
      if (!leaseExpired) {
        res.setHeader('Retry-After', '2');
        next(Object.assign(new Error('An identical request is already being processed.'), { status: 409 }));
        return;
      }

      const reclaimed = await IdempotencyRecordModel.updateOne({
        ...identity,
        state: 'processing',
        expiresAt: { $lte: new Date() }
      }, {
        $set: {
          method,
          path: req.originalUrl,
          request_hash: requestHash,
          expiresAt: new Date(Date.now() + PROCESSING_LEASE_MS)
        }
      });
      if (reclaimed.modifiedCount !== 1) {
        res.setHeader('Retry-After', '2');
        next(Object.assign(new Error('An identical request is already being processed.'), { status: 409 }));
        return;
      }
    } else {
      await IdempotencyRecordModel.create({
        ...identity,
        method,
        path: req.originalUrl,
        request_hash: requestHash,
        state: 'processing',
        expiresAt: new Date(Date.now() + PROCESSING_LEASE_MS)
      });
    }
  } catch (error: any) {
    if (error?.code === 11000) {
      res.setHeader('Retry-After', '2');
      next(Object.assign(new Error('An identical request is already being processed.'), { status: 409 }));
      return;
    }
    next(error);
    return;
  }

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response['json'];
  res.send = ((body: unknown) => {
    if (responseBody === undefined) responseBody = body;
    return originalSend(body);
  }) as Response['send'];

  res.once('finish', () => {
    const status = res.statusCode;
    if (status >= 200 && status < 300) {
      const responseHeaders: Record<string, string> = {};
      for (const name of ['content-type', 'etag']) {
        const value = res.getHeader(name);
        if (value) responseHeaders[name] = String(value);
      }
      void IdempotencyRecordModel.updateOne(identity, {
        $set: {
          state: 'completed',
          response_status: status,
          response_body: responseBody,
          response_headers: responseHeaders,
          expiresAt: new Date(Date.now() + RETENTION_MS)
        }
      }).catch(error => console.error('Failed to finalize idempotency record:', error));
      return;
    }
    void IdempotencyRecordModel.deleteOne(identity).catch(error => console.error('Failed to clear idempotency record:', error));
  });

  next();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key =>
    `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
  ).join(',')}}`;
}
