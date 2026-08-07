import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  queueConfig: { enabled: true, workerConcurrency: 7 },
  validateConfiguration: vi.fn(),
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
  initializeRedis: vi.fn(),
  disconnectRedis: vi.fn(),
  closeQueues: vi.fn(),
  shutdownTelemetry: vi.fn(),
  publishPendingOutboxEvents: vi.fn(),
  startDomainEventConsumer: vi.fn(),
  closeDomainEventConsumer: vi.fn(),
  registerNotificationHandlers: vi.fn(),
  registerWorkOrderEmailHandlers: vi.fn(),
  registerUserCreatedEmailHandlers: vi.fn(),
  registerObservationAssetHealthHandlers: vi.fn(),
  registerAssetHealthInitializationHandlers: vi.fn(),
  registerAssetEndpointCloneHandlers: vi.fn(),
  registerEquipmentEndpointSyncHandlers: vi.fn(),
  registerAssetReportProcessorHandlers: vi.fn(),
  registerAssetReportPdfHandlers: vi.fn(),
  gaugeSet: vi.fn(),
  plugin: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn()
}));

vi.mock('mongoose', () => ({ default: { plugin: dependencies.plugin } }));
vi.mock('./_db/mongoosePlugins', () => ({ idStandardizationPlugin: vi.fn() }));
vi.mock('./_db', () => ({
  connectDB: dependencies.connectDB,
  disconnectDB: dependencies.disconnectDB
}));
vi.mock('./_config/redis', () => ({
  initializeRedis: dependencies.initializeRedis,
  disconnectRedis: dependencies.disconnectRedis
}));
vi.mock('./configDB', () => ({
  queueConfig: dependencies.queueConfig,
  validateConfiguration: dependencies.validateConfiguration
}));
vi.mock('./instrumentation', () => ({ shutdownTelemetry: dependencies.shutdownTelemetry }));
vi.mock('./observability/logger', () => ({
  applicationLogger: {
    info: dependencies.info,
    error: dependencies.error,
    fatal: dependencies.fatal
  }
}));
vi.mock('./observability/metrics', () => ({
  workerConcurrencyGauge: { set: dependencies.gaugeSet }
}));
vi.mock('./queue/queue-registry', () => ({ closeQueues: dependencies.closeQueues }));
vi.mock('./queue/outbox-publisher', () => ({
  publishPendingOutboxEvents: dependencies.publishPendingOutboxEvents
}));
vi.mock('./queue/domain-event-consumer', () => ({
  startDomainEventConsumer: dependencies.startDomainEventConsumer,
  closeDomainEventConsumer: dependencies.closeDomainEventConsumer
}));
vi.mock('./queue/handlers/notification.handler', () => ({
  registerNotificationHandlers: dependencies.registerNotificationHandlers
}));
vi.mock('./queue/handlers/work-order-email.handler', () => ({
  registerWorkOrderEmailHandlers: dependencies.registerWorkOrderEmailHandlers
}));
vi.mock('./queue/handlers/user-created-email.handler', () => ({
  registerUserCreatedEmailHandlers: dependencies.registerUserCreatedEmailHandlers
}));
vi.mock('./queue/handlers/observation-asset-health.handler', () => ({
  registerObservationAssetHealthHandlers: dependencies.registerObservationAssetHealthHandlers
}));
vi.mock('./queue/handlers/asset-health-initialization.handler', () => ({
  registerAssetHealthInitializationHandlers: dependencies.registerAssetHealthInitializationHandlers
}));
vi.mock('./queue/handlers/asset-endpoint-clone.handler', () => ({
  registerAssetEndpointCloneHandlers: dependencies.registerAssetEndpointCloneHandlers
}));
vi.mock('./queue/handlers/equipment-endpoint-sync.handler', () => ({
  registerEquipmentEndpointSyncHandlers: dependencies.registerEquipmentEndpointSyncHandlers
}));
vi.mock('./queue/handlers/asset-report-processor.handler', () => ({
  registerAssetReportProcessorHandlers: dependencies.registerAssetReportProcessorHandlers
}));
vi.mock('./queue/handlers/asset-report-pdf.handler', () => ({
  registerAssetReportPdfHandlers: dependencies.registerAssetReportPdfHandlers
}));

const loadRuntime = async () => {
  vi.resetModules();
  return import('./worker.js');
};

describe('worker process lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.queueConfig.enabled = true;
    dependencies.queueConfig.workerConcurrency = 7;
    for (const dependency of [
      dependencies.connectDB,
      dependencies.disconnectDB,
      dependencies.initializeRedis,
      dependencies.disconnectRedis,
      dependencies.closeQueues,
      dependencies.shutdownTelemetry,
      dependencies.closeDomainEventConsumer
    ]) {
      dependency.mockResolvedValue(undefined);
    }
    dependencies.publishPendingOutboxEvents.mockResolvedValue(0);
  });

  it('rejects a worker process when queues are disabled before opening dependencies', async () => {
    dependencies.queueConfig.enabled = false;
    const { initializeWorker } = await loadRuntime();

    await expect(initializeWorker()).rejects.toThrow('QUEUE_ENABLED must be true for the worker');
    expect(dependencies.connectDB).not.toHaveBeenCalled();
    expect(dependencies.initializeRedis).not.toHaveBeenCalled();
  });

  it('initializes storage, handlers, consumer, metrics, and structured startup logging', async () => {
    const { initializeWorker } = await loadRuntime();

    await initializeWorker();

    expect(dependencies.validateConfiguration).toHaveBeenCalledOnce();
    expect(dependencies.connectDB).toHaveBeenCalledOnce();
    expect(dependencies.initializeRedis).toHaveBeenCalledOnce();
    expect(dependencies.registerNotificationHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerWorkOrderEmailHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerUserCreatedEmailHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerObservationAssetHealthHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerAssetHealthInitializationHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerAssetEndpointCloneHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerEquipmentEndpointSyncHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerAssetReportProcessorHandlers).toHaveBeenCalledOnce();
    expect(dependencies.registerAssetReportPdfHandlers).toHaveBeenCalledOnce();
    expect(dependencies.startDomainEventConsumer).toHaveBeenCalledOnce();
    expect(dependencies.gaugeSet).toHaveBeenCalledWith(7);
    expect(dependencies.info).toHaveBeenCalledWith(
      { concurrency: 7 },
      'CMMS outbox and domain-event worker started'
    );
  });

  it.each([
    { published: 1, delay: 25 },
    { published: 0, delay: 1000 }
  ])('paces an outbox batch with the $delay ms policy', async ({ published, delay }) => {
    vi.useFakeTimers();
    const runtime = await loadRuntime();
    let shutdownDone!: Promise<void>;
    dependencies.publishPendingOutboxEvents.mockImplementation(async () => {
      shutdownDone = runtime.shutdownWorker();
      return published;
    });

    const running = runtime.runWorker();
    await vi.advanceTimersByTimeAsync(delay);
    await running;
    await shutdownDone;

    expect(dependencies.publishPendingOutboxEvents).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('shares ordered shutdown work across repeated signals', async () => {
    let releaseConsumer!: () => void;
    dependencies.closeDomainEventConsumer.mockImplementation(() => new Promise<void>(resolve => {
      releaseConsumer = resolve;
    }));
    const { shutdownWorker } = await loadRuntime();

    const first = shutdownWorker();
    const second = shutdownWorker();
    expect(second).toBe(first);
    releaseConsumer();
    await first;

    expect(dependencies.closeDomainEventConsumer).toHaveBeenCalledOnce();
    expect(dependencies.closeQueues).toHaveBeenCalledOnce();
    expect(dependencies.disconnectRedis).toHaveBeenCalledOnce();
    expect(dependencies.disconnectDB).toHaveBeenCalledOnce();
    expect(dependencies.shutdownTelemetry).toHaveBeenCalledOnce();
    expect(dependencies.info).toHaveBeenCalledWith('CMMS outbox worker stopped');
  });

  it('maps worker shutdown success and failure to explicit process status', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    let runtime = await loadRuntime();
    await runtime.exitAfterWorkerShutdown();
    expect(exit).toHaveBeenCalledWith(0);

    vi.clearAllMocks();
    const failure = new Error('consumer close failed');
    dependencies.closeDomainEventConsumer.mockRejectedValue(failure);
    runtime = await loadRuntime();
    await runtime.exitAfterWorkerShutdown();
    expect(dependencies.error).toHaveBeenCalledWith(
      { err: failure },
      'CMMS outbox worker shutdown failed'
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('registers signals and fails closed after a worker startup error', async () => {
    const failure = new Error('database unavailable');
    dependencies.connectDB.mockRejectedValue(failure);
    const on = vi.spyOn(process, 'on').mockImplementation((() => process) as any);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const { registerWorkerProcessLifecycle } = await loadRuntime();

    registerWorkerProcessLifecycle();
    await vi.waitFor(() => expect(dependencies.fatal).toHaveBeenCalledWith(
      { err: failure },
      'CMMS outbox worker failed'
    ));

    expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(dependencies.closeDomainEventConsumer).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
