import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  info: vi.fn()
}));

vi.mock('./mongo.connection', () => ({
  MongoConnection: {
    connect: dependencies.connect,
    disconnect: dependencies.disconnect
  }
}));
vi.mock('../observability/logger', () => ({
  applicationLogger: { info: dependencies.info }
}));

import { connectDB, disconnectDB } from './index';

describe('database lifecycle facade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the connected Mongo client', async () => {
    const mongo = { connection: 'pooled' };
    dependencies.connect.mockResolvedValue(mongo);

    await expect(connectDB()).resolves.toEqual({ mongo });
    expect(dependencies.info).toHaveBeenCalledWith('\u2705 All databases connected successfully');
  });

  it('disconnects MongoDB before reporting complete shutdown', async () => {
    dependencies.disconnect.mockResolvedValue(undefined);

    await disconnectDB();

    expect(dependencies.disconnect).toHaveBeenCalledOnce();
    expect(dependencies.info).toHaveBeenCalledWith('\u2705 All databases disconnected successfully');
  });
});
