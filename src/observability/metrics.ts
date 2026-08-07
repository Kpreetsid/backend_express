import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ prefix: 'cmms_', register: metricsRegistry });

const requestCount = new Counter({
  name: 'cmms_http_requests_total',
  help: 'HTTP requests completed by method, route, and status.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [metricsRegistry]
});

const requestDuration = new Histogram({
  name: 'cmms_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
});

export const mongodbReadyGauge = new Gauge({
  name: 'cmms_mongodb_ready',
  help: 'MongoDB readiness, 1 when connected and pingable.',
  registers: [metricsRegistry]
});

export const redisReadyGauge = new Gauge({
  name: 'cmms_redis_ready',
  help: 'Redis readiness, 1 when disabled or connected and pingable.',
  registers: [metricsRegistry]
});

export const queueReadyGauge = new Gauge({
  name: 'cmms_queue_ready',
  help: 'BullMQ readiness, 1 when disabled or queryable.',
  registers: [metricsRegistry]
});

export const queueJobsGauge = new Gauge({
  name: 'cmms_queue_jobs',
  help: 'BullMQ domain-event jobs by state.',
  labelNames: ['state'] as const,
  registers: [metricsRegistry]
});

export const outboxPublishedCounter = new Counter({
  name: 'cmms_outbox_published_total',
  help: 'Outbox events successfully handed to BullMQ.',
  registers: [metricsRegistry]
});

export const outboxDeadLetterCounter = new Counter({
  name: 'cmms_outbox_dead_letter_total',
  help: 'Outbox events moved to the terminal dead-letter state.',
  registers: [metricsRegistry]
});

export const queueConsumerProcessedCounter = new Counter({
  name: 'cmms_queue_consumer_processed_total',
  help: 'Domain events successfully processed by registered handlers.',
  labelNames: ['type'] as const,
  registers: [metricsRegistry]
});

export const queueConsumerFailedCounter = new Counter({
  name: 'cmms_queue_consumer_failed_total',
  help: 'Domain event handler attempts that failed.',
  labelNames: ['type'] as const,
  registers: [metricsRegistry]
});

export const pdfJobsCounter = new Counter({
  name: 'cmms_asset_report_pdf_jobs_total',
  help: 'Asynchronous asset-report PDF jobs by outcome.',
  labelNames: ['result'] as const,
  registers: [metricsRegistry]
});

export const pdfJobDuration = new Histogram({
  name: 'cmms_asset_report_pdf_generation_duration_seconds',
  help: 'Time spent generating asynchronous asset-report PDFs.',
  labelNames: ['result'] as const,
  buckets: [1, 2.5, 5, 10, 20, 30, 60, 120, 300],
  registers: [metricsRegistry]
});

export const dependencyProbeDuration = new Histogram({
  name: 'cmms_dependency_probe_duration_seconds',
  help: 'Operational dependency probe duration in seconds.',
  labelNames: ['dependency', 'result'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry]
});

export const notificationSocketConnectionsGauge = new Gauge({
  name: 'cmms_notification_socket_connections',
  help: 'Currently connected notification-only Socket.IO clients.',
  registers: [metricsRegistry]
});

export const authenticationAnomalyCounter = new Counter({
  name: 'cmms_authentication_anomalies_total',
  help: 'Rejected authentication attempts by stable reason category.',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry]
});

export const uploadOperationsCounter = new Counter({
  name: 'cmms_upload_operations_total',
  help: 'Upload persistence operations by result.',
  labelNames: ['result'] as const,
  registers: [metricsRegistry]
});

export const schedulerRunsCounter = new Counter({
  name: 'cmms_scheduler_runs_total',
  help: 'Scheduled job executions by job and result.',
  labelNames: ['job', 'result'] as const,
  registers: [metricsRegistry]
});

export const workerConcurrencyGauge = new Gauge({
  name: 'cmms_worker_concurrency_limit',
  help: 'Configured BullMQ worker concurrency, used with active-job count to measure saturation.',
  registers: [metricsRegistry]
});

export const httpMetricsMiddleware = (): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const stopTimer = requestDuration.startTimer();
    res.on('finish', () => {
      const route = req.route?.path
        ? `${req.baseUrl}${String(req.route.path)}`
        : req.baseUrl || 'unmatched';
      const labels = { method: req.method, route, status: String(res.statusCode) };
      requestCount.inc(labels);
      stopTimer(labels);
    });
    next();
  };
