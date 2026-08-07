import { readFile } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdempotencyRecordModel } from '../models/idempotency-record.model';
import { applicationLogger } from '../observability/logger';
import { idempotencyMiddleware } from './idempotency.middleware';

vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}));
vi.mock('../models/idempotency-record.model', () => ({
  IdempotencyRecordModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn()
  }
}));
vi.mock('../observability/logger', () => ({
  applicationLogger: { error: vi.fn() }
}));

type FinishCallback = () => void;

function request(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    originalUrl: '/api/master/parts',
    body: { quantity: 2, name: 'Bearing' },
    user: { account_id: 'tenant-1', _id: 'user-1' },
    header: vi.fn((name: string) =>
      name === 'Idempotency-Key' ? 'parts-key' : undefined
    ),
    files: undefined,
    ...overrides
  };
}

function response(): {
  res: any;
  headers: Map<string, unknown>;
  finish: () => void;
} {
  const headers = new Map<string, unknown>();
  let finishCallback: FinishCallback | undefined;
  const res: any = {
    statusCode: 200,
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn((name: string, value: unknown) => {
      headers.set(name.toLowerCase(), value);
      return res;
    }),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    once: vi.fn((event: string, callback: FinishCallback) => {
      if (event === 'finish') finishCallback = callback;
      return res;
    }),
    status: vi.fn((statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    })
  };
  res.json.mockImplementation(() => res);
  res.send.mockImplementation(() => res);
  return {
    res,
    headers,
    finish: () => {
      if (!finishCallback) throw new Error('finish callback was not registered');
      finishCallback();
    }
  };
}

function findOneResult(value: unknown): void {
  vi.mocked(IdempotencyRecordModel.findOne).mockReturnValue({
    lean: vi.fn().mockResolvedValue(value)
  } as never);
}

async function captureRequestHash(req: any): Promise<string> {
  findOneResult(null);
  const next = vi.fn();
  await idempotencyMiddleware(req, response().res, next);
  expect(next).toHaveBeenCalledWith();
  return String(
    (vi.mocked(IdempotencyRecordModel.create).mock.calls.at(-1)?.[0] as any)
      .request_hash
  );
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOneResult(null);
    vi.mocked(IdempotencyRecordModel.create).mockResolvedValue({} as never);
    vi.mocked(IdempotencyRecordModel.updateOne).mockResolvedValue({
      modifiedCount: 1
    } as never);
    vi.mocked(IdempotencyRecordModel.deleteOne).mockResolvedValue({} as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('disk file') as never);
  });

  it('bypasses requests without a key and non-mutating methods', async () => {
    const noKeyNext = vi.fn();
    await idempotencyMiddleware(
      request({ header: vi.fn(() => undefined) }),
      response().res,
      noKeyNext
    );
    const getNext = vi.fn();
    await idempotencyMiddleware(
      request({ method: 'GET' }),
      response().res,
      getNext
    );

    expect(noKeyNext).toHaveBeenCalledWith();
    expect(getNext).toHaveBeenCalledWith();
    expect(IdempotencyRecordModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects oversized keys before accessing persistence', async () => {
    const next = vi.fn();

    await idempotencyMiddleware(
      request({
        header: vi.fn(() => 'x'.repeat(129))
      }),
      response().res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Idempotency-Key is too long.'
    }));
    expect(IdempotencyRecordModel.findOne).not.toHaveBeenCalled();
  });

  it('requires both authenticated tenant and user identity', async () => {
    const next = vi.fn();

    await idempotencyMiddleware(
      request({ user: { account_id: 'tenant-1' } }),
      response().res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 401,
      message: 'Authentication context is required for idempotent requests.'
    }));
    expect(IdempotencyRecordModel.findOne).not.toHaveBeenCalled();
  });

  it('creates a tenant-and-user scoped processing record', async () => {
    const next = vi.fn();

    await idempotencyMiddleware(request(), response().res, next);

    expect(IdempotencyRecordModel.findOne).toHaveBeenCalledWith({
      account_id: 'tenant-1',
      user_id: 'user-1',
      key: 'parts-key'
    });
    expect(IdempotencyRecordModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'tenant-1',
        user_id: 'user-1',
        key: 'parts-key',
        method: 'POST',
        path: '/api/master/parts',
        state: 'processing',
        request_hash: expect.stringMatching(/^[a-f\d]{64}$/)
      })
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('produces stable identity for reordered bodies and Multer field maps', async () => {
    const file = {
      fieldname: 'ignored-array-field',
      originalname: 'parts.csv',
      mimetype: 'text/csv',
      size: 4,
      buffer: Buffer.from('same')
    };
    const firstHash = await captureRequestHash(request({
      body: { name: 'Bearing', nested: { z: 2, a: 1 }, tags: ['a', 'b'] },
      files: { importFile: [file] }
    }));
    const secondHash = await captureRequestHash(request({
      body: { tags: ['a', 'b'], nested: { a: 1, z: 2 }, name: 'Bearing' },
      files: [{ ...file, fieldname: 'importFile' }]
    }));

    expect(firstHash).toBe(secondHash);
  });

  it('hashes disk-backed Multer files for import idempotency', async () => {
    const next = vi.fn();

    await idempotencyMiddleware(request({
      originalUrl: '/api/master/parts/import',
      files: [{
        fieldname: 'file',
        originalname: 'parts.csv',
        mimetype: 'text/csv',
        size: 9,
        path: 'D:\\safe-upload\\parts.csv'
      }]
    }), response().res, next);

    expect(readFile).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledWith('D:\\safe-upload\\parts.csv');
    expect(IdempotencyRecordModel.create).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('fails closed when uploaded bytes cannot be fingerprinted', async () => {
    const next = vi.fn();

    await idempotencyMiddleware(request({
      files: [{
        fieldname: 'file',
        originalname: 'parts.csv',
        mimetype: 'text/csv',
        size: 9
      }]
    }), response().res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Unable to fingerprint an uploaded file for idempotency.'
    }));
    expect(IdempotencyRecordModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects reuse of a key for a different body or file', async () => {
    const req = request({
      files: [{
        fieldname: 'file',
        originalname: 'parts.csv',
        mimetype: 'text/csv',
        size: 5,
        buffer: Buffer.from('first')
      }]
    });
    const originalHash = await captureRequestHash(req);
    findOneResult({
      request_hash: originalHash,
      state: 'completed',
      response_status: 201,
      response_body: {}
    });
    const next = vi.fn();

    await idempotencyMiddleware(request({
      body: { name: 'Different' },
      files: [{
        fieldname: 'file',
        originalname: 'parts.csv',
        mimetype: 'text/csv',
        size: 9,
        buffer: Buffer.from('different')
      }]
    }), response().res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 409,
      message: 'This Idempotency-Key was already used for a different request.'
    }));
  });

  it('replays the completed response and its safe headers', async () => {
    const req = request();
    const requestHash = await captureRequestHash(req);
    findOneResult({
      request_hash: requestHash,
      state: 'completed',
      response_status: 202,
      response_body: { status: true, data: { id: 'part-1' } },
      response_headers: {
        'content-type': 'application/json',
        etag: '"part-etag"'
      }
    });
    const context = response();
    const next = vi.fn();

    await idempotencyMiddleware(req, context.res, next);

    expect(context.res.setHeader).toHaveBeenCalledWith(
      'Idempotency-Replayed',
      'true'
    );
    expect(context.res.status).toHaveBeenCalledWith(202);
    expect(context.res.json).toHaveBeenCalledWith({
      status: true,
      data: { id: 'part-1' }
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a duplicate while the processing lease is active', async () => {
    const req = request();
    const requestHash = await captureRequestHash(req);
    findOneResult({
      request_hash: requestHash,
      state: 'processing',
      expiresAt: new Date(Date.now() + 60_000)
    });
    const context = response();
    const next = vi.fn();

    await idempotencyMiddleware(req, context.res, next);

    expect(context.res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 409,
      message: 'An identical request is already being processed.'
    }));
  });

  it('reclaims an expired processing lease atomically', async () => {
    const req = request();
    const requestHash = await captureRequestHash(req);
    findOneResult({
      request_hash: requestHash,
      state: 'processing',
      expiresAt: new Date(Date.now() - 60_000)
    });
    const next = vi.fn();

    await idempotencyMiddleware(req, response().res, next);

    expect(IdempotencyRecordModel.updateOne).toHaveBeenCalledWith(
      {
        account_id: 'tenant-1',
        user_id: 'user-1',
        key: 'parts-key',
        state: 'processing',
        expiresAt: { $lte: expect.any(Date) }
      },
      {
        $set: expect.objectContaining({
          method: 'POST',
          path: '/api/master/parts',
          request_hash: requestHash,
          expiresAt: expect.any(Date)
        })
      }
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when another worker wins expired-lease reclamation', async () => {
    const req = request();
    const requestHash = await captureRequestHash(req);
    findOneResult({
      request_hash: requestHash,
      state: 'processing',
      expiresAt: new Date(Date.now() - 60_000)
    });
    vi.mocked(IdempotencyRecordModel.updateOne).mockResolvedValue({
      modifiedCount: 0
    } as never);
    const context = response();
    const next = vi.fn();

    await idempotencyMiddleware(req, context.res, next);

    expect(context.res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });

  it('translates duplicate-key creation races into retryable conflicts', async () => {
    vi.mocked(IdempotencyRecordModel.create).mockRejectedValue({
      code: 11000
    } as never);
    const context = response();
    const next = vi.fn();

    await idempotencyMiddleware(request(), context.res, next);

    expect(context.res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });

  it('passes unexpected persistence failures to the error boundary', async () => {
    const databaseError = new Error('database unavailable');
    vi.mocked(IdempotencyRecordModel.create).mockRejectedValue(
      databaseError as never
    );
    const next = vi.fn();

    await idempotencyMiddleware(request(), response().res, next);

    expect(next).toHaveBeenCalledWith(databaseError);
  });

  it('finalizes successful JSON responses with safe replay metadata', async () => {
    const context = response();
    const next = vi.fn();
    await idempotencyMiddleware(request(), context.res, next);
    context.res.statusCode = 201;
    context.res.setHeader('Content-Type', 'application/json');
    context.res.setHeader('ETag', '"part-etag"');
    context.res.json({ status: true, data: { id: 'part-1' } });

    context.finish();
    await flushPromises();

    expect(IdempotencyRecordModel.updateOne).toHaveBeenLastCalledWith(
      {
        account_id: 'tenant-1',
        user_id: 'user-1',
        key: 'parts-key'
      },
      {
        $set: expect.objectContaining({
          state: 'completed',
          response_status: 201,
          response_body: { status: true, data: { id: 'part-1' } },
          response_headers: {
            'content-type': 'application/json',
            etag: '"part-etag"'
          },
          expiresAt: expect.any(Date)
        })
      }
    );
  });

  it('captures send responses when JSON was not used', async () => {
    const context = response();
    await idempotencyMiddleware(request(), context.res, vi.fn());
    context.res.statusCode = 204;
    context.res.send('accepted');

    context.finish();
    await flushPromises();

    expect(IdempotencyRecordModel.updateOne).toHaveBeenLastCalledWith(
      expect.any(Object),
      {
        $set: expect.objectContaining({
          response_status: 204,
          response_body: 'accepted'
        })
      }
    );
  });

  it('deletes the processing record after a non-success response', async () => {
    const context = response();
    await idempotencyMiddleware(request(), context.res, vi.fn());
    context.res.statusCode = 422;

    context.finish();
    await flushPromises();

    expect(IdempotencyRecordModel.deleteOne).toHaveBeenCalledTimes(1);
    expect(IdempotencyRecordModel.deleteOne).toHaveBeenCalledWith({
      account_id: 'tenant-1',
      user_id: 'user-1',
      key: 'parts-key'
    });
    expect(IdempotencyRecordModel.updateOne).not.toHaveBeenCalled();
  });

  it('logs asynchronous finalization failures without changing the response', async () => {
    const persistenceError = new Error('write failed');
    vi.mocked(IdempotencyRecordModel.updateOne).mockRejectedValue(
      persistenceError as never
    );
    const context = response();
    await idempotencyMiddleware(request(), context.res, vi.fn());
    context.res.statusCode = 200;

    context.finish();
    await flushPromises();

    expect(applicationLogger.error).toHaveBeenCalledWith(
      'Failed to finalize idempotency record:',
      persistenceError
    );
  });
});
