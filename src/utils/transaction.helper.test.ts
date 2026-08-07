import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('../observability/logger', () => ({
  applicationLogger: { warn: logger.warn }
}));

const sessionFixture = () => ({
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn().mockResolvedValue(undefined),
  inTransaction: vi.fn().mockReturnValue(true)
});

describe('transaction helper primary-read and fallback behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    logger.warn.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('reuses an existing transaction session without creating another session', async () => {
    const startSession = vi.spyOn(mongoose, 'startSession');
    const { withTransaction } = await import('./transaction.helper.js');
    const existingSession = { id: 'existing' };
    const operation = vi.fn().mockResolvedValue('result');

    await expect(withTransaction(operation, existingSession)).resolves.toBe('result');

    expect(operation).toHaveBeenCalledWith(existingSession);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('starts app-managed transactions with primary read preference and commits once', async () => {
    const session = sessionFixture();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);
    const { withTransaction } = await import('./transaction.helper.js');
    const operation = vi.fn().mockResolvedValue({ saved: true });

    await expect(withTransaction(operation)).resolves.toEqual({ saved: true });

    expect(session.startTransaction).toHaveBeenCalledOnce();
    expect(session.startTransaction).toHaveBeenCalledWith({ readPreference: 'primary' });
    expect(operation).toHaveBeenCalledWith(session);
    expect(session.commitTransaction).toHaveBeenCalledOnce();
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('aborts, closes, and rethrows ordinary transaction failures', async () => {
    const session = sessionFixture();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);
    const { withTransaction } = await import('./transaction.helper.js');
    const failure = new Error('write conflict');

    await expect(withTransaction(async () => { throw failure; })).rejects.toBe(failure);

    expect(session.abortTransaction).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  it('falls back without a session for unsupported deployments and remembers the capability', async () => {
    const session = sessionFixture();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);
    const { withTransaction } = await import('./transaction.helper.js');
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Transaction is not supported'), { code: 20 }))
      .mockResolvedValueOnce('fallback')
      .mockResolvedValueOnce('cached-fallback');

    await expect(withTransaction(operation)).resolves.toBe('fallback');
    await expect(withTransaction(operation)).resolves.toBe('cached-fallback');

    expect(operation.mock.calls[0]![0]).toBe(session);
    expect(operation.mock.calls[1]![0]).toBeUndefined();
    expect(operation.mock.calls[2]![0]).toBeUndefined();
    expect(session.abortTransaction).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
    expect(mongoose.startSession).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('recognizes unsupported deployment errors from errmsg and codeName variants', async () => {
    const firstSession = sessionFixture();
    const secondSession = sessionFixture();
    vi.spyOn(mongoose, 'startSession')
      .mockResolvedValueOnce(firstSession as any)
      .mockResolvedValueOnce(secondSession as any);

    let module = await import('./transaction.helper.js');
    const errmsgOperation = vi.fn()
      .mockRejectedValueOnce({ errmsg: 'replica set member or mongos required' })
      .mockResolvedValueOnce('fallback');
    await expect(module.withTransaction(errmsgOperation)).resolves.toBe('fallback');

    vi.resetModules();
    module = await import('./transaction.helper.js');
    const codeNameOperation = vi.fn()
      .mockRejectedValueOnce({ codeName: 'IllegalOperation' })
      .mockResolvedValueOnce('fallback');
    await expect(module.withTransaction(codeNameOperation)).resolves.toBe('fallback');
  });
});
