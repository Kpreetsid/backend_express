import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  plugin: vi.fn(),
  connectionOn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  database: {
    uri: '',
    userName: '',
    password: '',
    authSource: '',
    host: 'mongo.internal',
    port: 27017,
    databaseName: 'cmms',
    retryWrites: true,
    autoIndex: false,
    maxPoolSize: 40,
    minPoolSize: 5
  }
}));

vi.mock('mongoose', () => ({
  default: {
    connect: dependencies.connect,
    disconnect: dependencies.disconnect,
    plugin: dependencies.plugin,
    connection: { on: dependencies.connectionOn }
  }
}));

vi.mock('../configDB', () => ({ database: dependencies.database }));
vi.mock('./mongoosePlugins', () => ({ idStandardizationPlugin: vi.fn() }));
vi.mock('../observability/logger', () => ({
  applicationLogger: {
    info: dependencies.info,
    error: dependencies.error
  }
}));

import mongoose from 'mongoose';
import { MongoConnection } from './mongo.connection';

describe('MongoConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (MongoConnection as any).instance = null;
    Object.assign(dependencies.database, {
      uri: '',
      userName: '',
      password: '',
      authSource: '',
      host: 'mongo.internal',
      port: 27017,
      databaseName: 'cmms',
      retryWrites: true,
      autoIndex: false,
      maxPoolSize: 40,
      minPoolSize: 5
    });
    dependencies.connect.mockResolvedValue(mongoose);
    dependencies.disconnect.mockResolvedValue(undefined);
  });

  it('connects with a constructed credential-free pooled URI and lifecycle logging', async () => {
    await expect(MongoConnection.connect()).resolves.toBe(mongoose);

    expect(dependencies.connect).toHaveBeenCalledWith(
      'mongodb://mongo.internal:27017/cmms?retryWrites=true',
      {
        autoIndex: false,
        connectTimeoutMS: 10000,
        maxPoolSize: 40,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      }
    );
    expect(dependencies.connectionOn).toHaveBeenCalledTimes(3);

    const handlers = new Map<string, (...args: any[]) => void>();
    for (const [event, handler] of dependencies.connectionOn.mock.calls as Array<[
      string,
      (...args: any[]) => void
    ]>) {
      handlers.set(event, handler);
    }
    handlers.get('connected')!();
    handlers.get('error')!(new Error('connection event'));
    handlers.get('disconnected')!();
    expect(dependencies.info).toHaveBeenCalled();
    expect(dependencies.error).toHaveBeenCalledWith(
      '\u2757 Mongoose error:',
      expect.any(Error)
    );
  });

  it('uses the configured URI verbatim when managed MongoDB supplies one', async () => {
    dependencies.database.uri = 'mongodb+srv://managed.example/cmms?retryWrites=true';

    await MongoConnection.connect();

    expect(dependencies.connect.mock.calls[0]![0]).toBe(dependencies.database.uri);
  });

  it('encodes credentials and includes authSource only for credentialed connections', async () => {
    Object.assign(dependencies.database, {
      userName: 'cmms user',
      password: 'p@ss/word',
      authSource: 'admin auth',
      retryWrites: false
    });

    await MongoConnection.connect();

    expect(dependencies.connect.mock.calls[0]![0]).toBe(
      'mongodb://cmms%20user:p%40ss%2Fword@mongo.internal:27017/cmms?' +
      'retryWrites=false&authSource=admin+auth'
    );
  });

  it('reuses the pooled singleton and disconnects only while connected', async () => {
    const first = await MongoConnection.connect();
    const second = await MongoConnection.connect();

    expect(second).toBe(first);
    expect(dependencies.connect).toHaveBeenCalledOnce();
    expect(dependencies.info).toHaveBeenCalledWith('\u26A1 MongoDB already connected (pooled)');

    await MongoConnection.disconnect();
    await MongoConnection.disconnect();
    expect(dependencies.disconnect).toHaveBeenCalledOnce();
  });

  it('logs connection failures and exits instead of leaving a partially started process', async () => {
    const failure = new Error('selection failed');
    dependencies.connect.mockRejectedValue(failure);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    await expect(MongoConnection.connect()).rejects.toThrow('exit:1');
    expect(dependencies.error).toHaveBeenCalledWith(
      { err: failure },
      '\u274C MongoDB connection error:'
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
