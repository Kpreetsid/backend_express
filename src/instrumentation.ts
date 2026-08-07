import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { telemetryConfig } from './configDB';

let sdk: NodeSDK | undefined;

export const otlpSignalUrl = (
  endpoint: string,
  signal: 'traces' | 'metrics'
): string => `${endpoint
  .replace(/\/$/, '')
  .replace(/\/v1\/(?:traces|metrics|logs)$/, '')}/v1/${signal}`;

if (telemetryConfig.enabled && telemetryConfig.endpoint) {
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: otlpSignalUrl(telemetryConfig.endpoint, 'traces'),
      headers: telemetryConfig.headers
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: otlpSignalUrl(telemetryConfig.endpoint, 'metrics'),
        headers: telemetryConfig.headers
      }),
      exportIntervalMillis: 60_000
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }
      })
    ]
  });
  sdk.start();
}

export const shutdownTelemetry = async (): Promise<void> => {
  await sdk?.shutdown();
};
