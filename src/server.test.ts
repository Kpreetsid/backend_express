import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  validateConfiguration: vi.fn(),
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
  initializeRedis: vi.fn(),
  disconnectRedis: vi.fn(),
  initSocket: vi.fn(),
  closeSocket: vi.fn(),
  initJobScheduler: vi.fn(),
  closeQueues: vi.fn(),
  shutdownTelemetry: vi.fn(),
  plugin: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  server: undefined as any
}));

vi.mock('mongoose', () => ({ default: { plugin: dependencies.plugin } }));
vi.mock('./_db/mongoosePlugins', () => ({ idStandardizationPlugin: vi.fn() }));
vi.mock('./app', () => ({ default: vi.fn() }));
vi.mock('./configDB', () => ({
  server: { host: '127.0.0.1', port: 8080 },
  validateConfiguration: dependencies.validateConfiguration
}));
vi.mock('./_db', () => ({
  connectDB: dependencies.connectDB,
  disconnectDB: dependencies.disconnectDB
}));
vi.mock('./cron', () => ({ initJobScheduler: dependencies.initJobScheduler }));
vi.mock('./_config/socket', () => ({
  initSocket: dependencies.initSocket,
  closeSocket: dependencies.closeSocket
}));
vi.mock('./_config/redis', () => ({
  initializeRedis: dependencies.initializeRedis,
  disconnectRedis: dependencies.disconnectRedis
}));
vi.mock('./queue/queue-registry', () => ({ closeQueues: dependencies.closeQueues }));
vi.mock('./instrumentation', () => ({ shutdownTelemetry: dependencies.shutdownTelemetry }));
vi.mock('./observability/logger', () => ({
  applicationLogger: {
    info: dependencies.info,
    error: dependencies.error,
    fatal: dependencies.fatal
  }
}));
vi.mock('http', () => ({ createServer: vi.fn(() => dependencies.server) }));

const loadRuntime = async () => {
  vi.resetModules();
  return import('./server.js');
};

describe('API process lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.server = {
      listening: false,
      listen: vi.fn((_port: number, _host: string, callback: () => void) => callback()),
      close: vi.fn((callback: (error?: Error) => void) => callback())
    };
    for (const dependency of [
      dependencies.connectDB,
      dependencies.disconnectDB,
      dependencies.initializeRedis,
      dependencies.disconnectRedis,
      dependencies.initSocket,
      dependencies.closeSocket,
      dependencies.initJobScheduler,
      dependencies.closeQueues,
      dependencies.shutdownTelemetry
    ]) {
      dependency.mockResolvedValue(undefined);
    }
  });

  it('starts dependencies before listening and records the bound address', async () => {
    const { bootstrap, server } = await loadRuntime();

    await bootstrap();

    expect(dependencies.validateConfiguration).toHaveBeenCalledOnce();
    expect(dependencies.connectDB).toHaveBeenCalledOnce();
    expect(dependencies.initializeRedis).toHaveBeenCalledOnce();
    expect(dependencies.initSocket).toHaveBeenCalledWith(server);
    expect(dependencies.initJobScheduler).toHaveBeenCalledOnce();
    expect(dependencies.server.listen).toHaveBeenCalledWith(
      8080,
      '127.0.0.1',
      expect.any(Function)
    );
    expect(dependencies.info).toHaveBeenCalledWith(
      { host: '127.0.0.1', port: 8080 },
      'CMMS API started'
    );
    expect(dependencies.connectDB.mock.invocationCallOrder[0])
      .toBeLessThan(dependencies.initializeRedis.mock.invocationCallOrder[0]!);
    expect(dependencies.initializeRedis.mock.invocationCallOrder[0])
      .toBeLessThan(dependencies.initSocket.mock.invocationCallOrder[0]!);
  });

  it('fails startup before later dependencies when MongoDB cannot connect', async () => {
    const failure = new Error('mongo unavailable');
    dependencies.connectDB.mockRejectedValue(failure);
    const { bootstrap } = await loadRuntime();

    await expect(bootstrap()).rejects.toBe(failure);
    expect(dependencies.initializeRedis).not.toHaveBeenCalled();
    expect(dependencies.initSocket).not.toHaveBeenCalled();
    expect(dependencies.server.listen).not.toHaveBeenCalled();
  });

  it('closes every dependency in safe order and shares concurrent shutdown work', async () => {
    dependencies.server.listening = true;
    let releaseSocket!: () => void;
    dependencies.closeSocket.mockImplementation(() => new Promise<void>(resolve => {
      releaseSocket = resolve;
    }));
    const { shutdown } = await loadRuntime();

    const first = shutdown();
    const second = shutdown();
    expect(second).toBe(first);
    expect(dependencies.closeSocket).toHaveBeenCalledOnce();
    releaseSocket();
    await first;

    expect(dependencies.server.close).toHaveBeenCalledOnce();
    expect(dependencies.closeQueues).toHaveBeenCalledOnce();
    expect(dependencies.disconnectRedis).toHaveBeenCalledOnce();
    expect(dependencies.disconnectDB).toHaveBeenCalledOnce();
    expect(dependencies.shutdownTelemetry).toHaveBeenCalledOnce();
    expect(dependencies.info).toHaveBeenCalledWith('Server closed');
  });

  it('skips HTTP close when not listening and propagates cleanup failures', async () => {
    const failure = new Error('queue close failed');
    dependencies.closeQueues.mockRejectedValue(failure);
    const { shutdown } = await loadRuntime();

    await expect(shutdown()).rejects.toBe(failure);

    expect(dependencies.server.close).not.toHaveBeenCalled();
    expect(dependencies.disconnectRedis).not.toHaveBeenCalled();
    expect(dependencies.error).toHaveBeenCalledWith(
      { err: failure },
      'Graceful shutdown failed'
    );
  });

  it('propagates HTTP close errors without continuing dependency teardown', async () => {
    const failure = new Error('http close failed');
    dependencies.server.listening = true;
    dependencies.server.close.mockImplementation((callback: (error?: Error) => void) => callback(failure));
    const { shutdown } = await loadRuntime();

    await expect(shutdown()).rejects.toBe(failure);
    expect(dependencies.closeQueues).not.toHaveBeenCalled();
    expect(dependencies.error).toHaveBeenCalledWith(
      { err: failure },
      'Graceful shutdown failed'
    );
  });

  it('forces a failed exit when graceful shutdown exceeds its bound', async () => {
    vi.useFakeTimers();
    let releaseSocket!: () => void;
    dependencies.closeSocket.mockImplementation(() => new Promise<void>(resolve => {
      releaseSocket = resolve;
    }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const { shutdown } = await loadRuntime();

    const pending = shutdown();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(dependencies.fatal).toHaveBeenCalledWith('Graceful shutdown timed out');
    expect(exit).toHaveBeenCalledWith(1);
    releaseSocket();
    await pending;
    vi.useRealTimers();
  });

  it('maps successful and failed shutdowns to process exit status', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    let runtime = await loadRuntime();

    await runtime.exitAfterShutdown();
    expect(exit).toHaveBeenCalledWith(0);

    vi.clearAllMocks();
    dependencies.closeSocket.mockRejectedValue(new Error('socket close failed'));
    runtime = await loadRuntime();
    await runtime.exitAfterShutdown();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('registers signal handlers and fails closed when startup rejects', async () => {
    const failure = new Error('startup failed');
    dependencies.connectDB.mockRejectedValue(failure);
    const on = vi.spyOn(process, 'on').mockImplementation((() => process) as any);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const { registerProcessLifecycle } = await loadRuntime();

    registerProcessLifecycle();
    await vi.waitFor(() => expect(dependencies.fatal).toHaveBeenCalledWith(
      { err: failure },
      'CMMS API startup failed'
    ));

    expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
