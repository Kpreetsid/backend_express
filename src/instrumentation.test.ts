import { describe, expect, it } from 'vitest';
import { otlpSignalUrl } from './instrumentation';

describe('OpenTelemetry signal endpoints', () => {
  it.each([
    ['https://collector.example', 'traces', 'https://collector.example/v1/traces'],
    ['https://collector.example/', 'metrics', 'https://collector.example/v1/metrics'],
    ['https://collector.example/v1/traces', 'metrics', 'https://collector.example/v1/metrics'],
    ['https://collector.example/v1/metrics', 'traces', 'https://collector.example/v1/traces']
  ] as const)('builds %s %s endpoint', (endpoint, signal, expected) => {
    expect(otlpSignalUrl(endpoint, signal)).toBe(expected);
  });
});
