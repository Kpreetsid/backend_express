import mongoose from 'mongoose';
import { idStandardizationPlugin } from './_db/mongoosePlugins';
import { connectDB, disconnectDB } from './_db';
import { disconnectRedis, initializeRedis } from './_config/redis';
import { queueConfig, validateConfiguration } from './configDB';
import { shutdownTelemetry } from './instrumentation';
import { applicationLogger } from './observability/logger';
import { closeQueues } from './queue/queue-registry';
import { publishPendingOutboxEvents } from './queue/outbox-publisher';
import {
  closeDomainEventConsumer,
  startDomainEventConsumer
} from './queue/domain-event-consumer';
import { registerNotificationHandlers } from './queue/handlers/notification.handler';
import { registerWorkOrderEmailHandlers } from './queue/handlers/work-order-email.handler';
import { registerUserCreatedEmailHandlers } from './queue/handlers/user-created-email.handler';
import { registerObservationAssetHealthHandlers } from './queue/handlers/observation-asset-health.handler';
import { registerAssetHealthInitializationHandlers } from './queue/handlers/asset-health-initialization.handler';
import { registerAssetEndpointCloneHandlers } from './queue/handlers/asset-endpoint-clone.handler';
import { registerEquipmentEndpointSyncHandlers } from './queue/handlers/equipment-endpoint-sync.handler';
import { registerAssetReportProcessorHandlers } from './queue/handlers/asset-report-processor.handler';
import { registerAssetReportPdfHandlers } from './queue/handlers/asset-report-pdf.handler';
import { workerConcurrencyGauge } from './observability/metrics';

mongoose.plugin(idStandardizationPlugin);

let stopping = false;
let shutdownPromise: Promise<void> | undefined;

export const initializeWorker = async (): Promise<void> => {
  validateConfiguration();
  if (!queueConfig.enabled) throw new Error('QUEUE_ENABLED must be true for the worker');
  await connectDB();
  await initializeRedis();
  registerNotificationHandlers();
  registerWorkOrderEmailHandlers();
  registerUserCreatedEmailHandlers();
  registerObservationAssetHealthHandlers();
  registerAssetHealthInitializationHandlers();
  registerAssetEndpointCloneHandlers();
  registerEquipmentEndpointSyncHandlers();
  registerAssetReportProcessorHandlers();
  registerAssetReportPdfHandlers();
  startDomainEventConsumer();
  workerConcurrencyGauge.set(queueConfig.workerConcurrency);
  applicationLogger.info({
    concurrency: queueConfig.workerConcurrency
  }, 'CMMS outbox and domain-event worker started');
};

export const runWorker = async (): Promise<void> => {
  await initializeWorker();
  while (!stopping) {
    const published = await publishPendingOutboxEvents();
    await new Promise((resolve) => setTimeout(resolve, published > 0 ? 25 : 1000));
  }
};

export const shutdownWorker = (): Promise<void> => {
  if (shutdownPromise) return shutdownPromise;
  stopping = true;
  shutdownPromise = (async () => {
    await closeDomainEventConsumer();
    await closeQueues();
    await disconnectRedis();
    await disconnectDB();
    await shutdownTelemetry();
    applicationLogger.info('CMMS outbox worker stopped');
  })();
  return shutdownPromise;
};

export const exitAfterWorkerShutdown = async (): Promise<void> => {
  try {
    await shutdownWorker();
    process.exit(0);
  } catch (error) {
    applicationLogger.error({ err: error }, 'CMMS outbox worker shutdown failed');
    process.exit(1);
  }
};

export const registerWorkerProcessLifecycle = (): void => {
  process.on('SIGINT', exitAfterWorkerShutdown);
  process.on('SIGTERM', exitAfterWorkerShutdown);

  runWorker().catch(async (error) => {
    applicationLogger.fatal({ err: error }, 'CMMS outbox worker failed');
    try {
      await shutdownWorker();
    } finally {
      process.exit(1);
    }
  });
};

if (require.main === module) {
  registerWorkerProcessLifecycle();
}
