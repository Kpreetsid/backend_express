# Observability

Structured, redacted JSON logs include request ID, trace ID, tenant, user, route template, duration, result, deployment version, and job ID where applicable. `X-Request-ID` and W3C `traceparent` are propagated end to end.

OpenTelemetry exports traces and automatic instrumentation metrics to the
approved OTLP collector. Structured Pino output is shipped by the CloudWatch
agent to separate KMS-encrypted API and worker log groups. Terraform defines
the operations dashboard, API latency/5xx/health/CPU alarms, Redis
CPU/memory alarms, notification actions, and Auto Scaling target tracking.

Liveness proves the process can run. Startup proves initialization completed. Readiness performs bounded checks of every dependency required to serve safely and returns 503 when a required dependency is unavailable.

Current repository metrics include HTTP count/latency, MongoDB, Redis and
BullMQ readiness, queue depth by state, outbox publications, and outbox
dead-letter events. `cmms_queue_consumer_processed_total{type}` and
`cmms_queue_consumer_failed_total{type}` measure versioned handler outcomes.
`cmms_asset_report_pdf_jobs_total{result}` and
`cmms_asset_report_pdf_generation_duration_seconds{result}` expose PDF worker
outcomes and duration independently from HTTP latency.
Dependency probe duration, notification-socket connections, worker
concurrency, upload outcomes, authentication anomalies, and scheduler outcomes
are also measured. `/metrics` requires a constant-time validated bearer
credential in production and health/metrics probes do not generate database
audit writes.

Dashboard definitions, encrypted retention, fixed process-log paths, ALB
access logging, and alarms are provider-validated in Terraform. Actual alert
delivery, searchable traces, managed MongoDB query-plan/pool dashboards, and
SLO evidence remain environment-owned release evidence.
