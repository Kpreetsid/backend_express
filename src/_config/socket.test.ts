import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  io: {
    adapter: vi.fn(),
    use: vi.fn(),
    on: vi.fn(),
    close: vi.fn()
  },
  serverConstructor: vi.fn(),
  verify: vi.fn(),
  originAllowed: vi.fn(),
  redisClient: undefined as any,
  createAdapter: vi.fn(),
  notificationInit: vi.fn(),
  markAsReached: vi.fn(),
  anomalyInc: vi.fn(),
  connectionInc: vi.fn(),
  connectionDec: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  socketPrefix: vi.fn(() => 'cmms:{test}:global:socket.io')
}));

vi.mock('socket.io', () => ({
  Server: class {
    constructor(...args: any[]) {
      dependencies.serverConstructor(...args);
      return dependencies.io;
    }
  }
}));

vi.mock('jsonwebtoken', () => ({
  default: { verify: dependencies.verify }
}));

vi.mock('../configDB', () => ({
  auth: {
    secret: 'socket-secret',
    algorithm: 'HS256',
    issuer: 'cmms-api',
    audience: 'cmms-clients'
  }
}));

vi.mock('./cors', () => ({ isOriginAllowed: dependencies.originAllowed }));
vi.mock('./redis', () => ({ getRedisClient: () => dependencies.redisClient }));
vi.mock('@socket.io/redis-adapter', () => ({ createAdapter: dependencies.createAdapter }));
vi.mock('./redis-keys', () => ({
  redisKeys: { socketAdapterPrefix: dependencies.socketPrefix }
}));
vi.mock('../utils/notification.service', () => ({
  notificationService: {
    init: dependencies.notificationInit,
    markAsReached: dependencies.markAsReached
  }
}));
vi.mock('../observability/metrics', () => ({
  authenticationAnomalyCounter: { inc: dependencies.anomalyInc },
  notificationSocketConnectionsGauge: {
    inc: dependencies.connectionInc,
    dec: dependencies.connectionDec
  }
}));
vi.mock('../observability/logger', () => ({
  applicationLogger: {
    info: dependencies.loggerInfo,
    error: dependencies.loggerError
  }
}));

import { closeSocket, initSocket } from './socket';

const handshakeSocket = (overrides: Record<string, any> = {}) => ({
  handshake: {
    auth: {},
    headers: {},
    ...overrides
  },
  data: {} as Record<string, any>
});

describe('Socket.IO notification authentication and distributed lifecycle', () => {
  beforeEach(() => {
    dependencies.redisClient = undefined;
    dependencies.io.adapter.mockReset();
    dependencies.io.use.mockReset();
    dependencies.io.on.mockReset();
    dependencies.io.close.mockReset().mockImplementation((callback: () => void) => callback());
    dependencies.serverConstructor.mockReset();
    dependencies.verify.mockReset();
    dependencies.originAllowed.mockReset();
    dependencies.createAdapter.mockReset().mockReturnValue('redis-adapter');
    dependencies.notificationInit.mockReset();
    dependencies.markAsReached.mockReset().mockResolvedValue(undefined);
    dependencies.anomalyInc.mockReset();
    dependencies.connectionInc.mockReset();
    dependencies.connectionDec.mockReset();
    dependencies.loggerInfo.mockReset();
    dependencies.loggerError.mockReset();
    dependencies.socketPrefix.mockClear();
  });

  afterEach(async () => {
    await closeSocket();
  });

  it('initializes notification sockets with explicit CORS and no adapter when Redis is disabled', async () => {
    const httpServer = { id: 'http-server' } as any;
    dependencies.originAllowed.mockImplementation((origin?: string) => origin === 'https://allowed.example');

    await expect(initSocket(httpServer)).resolves.toBe(dependencies.io);

    expect(dependencies.serverConstructor).toHaveBeenCalledOnce();
    const [serverArg, options] = dependencies.serverConstructor.mock.calls[0]!;
    expect(serverArg).toBe(httpServer);
    expect(options.cors).toMatchObject({
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true
    });
    const allowed = vi.fn();
    options.cors.origin('https://allowed.example', allowed);
    expect(allowed).toHaveBeenCalledWith(null, true);
    const denied = vi.fn();
    options.cors.origin('https://denied.example', denied);
    expect(denied.mock.calls[0]![0]).toEqual(expect.objectContaining({
      message: 'Origin is not allowed by Socket.io CORS policy'
    }));
    expect(dependencies.io.adapter).not.toHaveBeenCalled();
    expect(dependencies.notificationInit).toHaveBeenCalledWith(dependencies.io);
  });

  it('connects a dedicated Redis subscriber and closes distributed resources cleanly', async () => {
    const subscriber = {
      isOpen: true,
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };
    dependencies.redisClient = { duplicate: vi.fn().mockReturnValue(subscriber) };

    await initSocket({} as any);

    expect(dependencies.redisClient.duplicate).toHaveBeenCalledOnce();
    expect(subscriber.on).toHaveBeenCalledWith('error', expect.any(Function));
    const redisError = new Error('subscriber unavailable');
    subscriber.on.mock.calls[0]![1](redisError);
    expect(dependencies.loggerError).toHaveBeenCalledWith(
      { err: redisError },
      'Socket.IO Redis subscriber error'
    );
    expect(subscriber.connect).toHaveBeenCalledOnce();
    expect(dependencies.createAdapter).toHaveBeenCalledWith(
      dependencies.redisClient,
      subscriber,
      { key: 'cmms:{test}:global:socket.io' }
    );
    expect(dependencies.io.adapter).toHaveBeenCalledWith('redis-adapter');

    await closeSocket();
    expect(dependencies.io.close).toHaveBeenCalledOnce();
    expect(subscriber.close).toHaveBeenCalledOnce();
  });

  it('rejects missing, invalid, and cross-tenant socket credentials', async () => {
    await initSocket({} as any);
    const middleware = dependencies.io.use.mock.calls[0]![0];

    const missingNext = vi.fn();
    middleware(handshakeSocket(), missingNext);
    expect(missingNext.mock.calls[0]![0].message)
      .toBe('Authentication error: Token and Account ID required');
    expect(dependencies.anomalyInc).toHaveBeenCalledWith({ reason: 'socket_missing_credentials' });

    dependencies.verify.mockImplementationOnce(() => { throw new Error('invalid signature'); });
    const invalidNext = vi.fn();
    middleware(handshakeSocket({ auth: { token: 'invalid', accountId: 'account-1' } }), invalidNext);
    expect(invalidNext.mock.calls[0]![0].message).toBe('Authentication error: Invalid token');
    expect(dependencies.anomalyInc).toHaveBeenCalledWith({ reason: 'socket_invalid_token' });

    dependencies.verify.mockReturnValueOnce({ id: 'user-1', companyID: 'account-1' });
    const mismatchNext = vi.fn();
    middleware(handshakeSocket({ auth: { token: 'valid', accountId: 'account-2' } }), mismatchNext);
    expect(mismatchNext.mock.calls[0]![0].message).toBe('Authentication error: Account ID mismatch');
    expect(dependencies.anomalyInc).toHaveBeenCalledWith({ reason: 'socket_tenant_mismatch' });
  });

  it('accepts matching header credentials and attaches verified session identity', async () => {
    dependencies.verify.mockReturnValue({ id: 'user-1', companyID: 'account-1' });
    await initSocket({} as any);
    const middleware = dependencies.io.use.mock.calls[0]![0];
    const socket = handshakeSocket({
      headers: { authorization: 'Bearer valid-token', accountid: 'account-1' }
    });
    const next = vi.fn();

    middleware(socket, next);

    expect(dependencies.verify).toHaveBeenCalledWith('valid-token', 'socket-secret', {
      algorithms: ['HS256'],
      issuer: 'cmms-api',
      audience: 'cmms-clients'
    });
    expect(socket.data).toEqual({
      user: { id: 'user-1', companyID: 'account-1' },
      accountId: 'account-1'
    });
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('joins only the verified user room and handles acknowledgement and disconnect metrics', async () => {
    await initSocket({} as any);
    const connection = dependencies.io.on.mock.calls.find(([event]) => event === 'connection')![1];
    const handlers = new Map<string, (...args: any[]) => any>();
    const socket = {
      data: { user: { id: 123 }, accountId: 'account-1' },
      join: vi.fn(),
      on: vi.fn((event: string, handler: (...args: any[]) => any) => handlers.set(event, handler))
    };

    connection(socket);

    expect(socket.join).toHaveBeenCalledWith('123');
    expect(dependencies.connectionInc).toHaveBeenCalledOnce();
    await handlers.get('notification_reached')!({ notificationId: 'notification-1' });
    expect(dependencies.markAsReached).toHaveBeenCalledWith('notification-1', 123);
    expect(dependencies.loggerInfo).toHaveBeenCalledWith(
      { notificationId: 'notification-1', userId: 123, accountId: 'account-1' },
      'Notification reached acknowledgement'
    );

    const failure = new Error('write unavailable');
    dependencies.markAsReached.mockRejectedValueOnce(failure);
    await handlers.get('notification_reached')!({ notificationId: 'notification-2' });
    expect(dependencies.loggerError).toHaveBeenCalledWith(
      { err: failure, userId: 123, accountId: 'account-1' },
      'Error marking notification as reached'
    );

    handlers.get('disconnect')!();
    expect(dependencies.connectionDec).toHaveBeenCalledOnce();
    expect(dependencies.loggerInfo).toHaveBeenCalledWith(
      { userId: 123, accountId: 'account-1' },
      'Notification socket disconnected'
    );
  });

  it('allows repeated shutdown when no server or open subscriber remains', async () => {
    await closeSocket();
    await expect(closeSocket()).resolves.toBeUndefined();
    expect(dependencies.io.close).not.toHaveBeenCalled();
  });
});
