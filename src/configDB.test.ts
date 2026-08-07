import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const productionEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://example.invalid/cmms',
  AUTH_SECRET: '12345678901234567890123456789012',
  EXTERNAL_AUTH_SECRET: 'external-123456789012345678901234',
  REFRESH_TOKEN_SECRET: 'refresh-1234567890123456789012345',
  AUTH_ISSUER: 'cmms-api',
  AUTH_AUDIENCE: 'cmms-client',
  PAYLOAD_CRYPTO_ENABLED: 'true',
  PAYLOAD_CRYPTO_MASTER_SECRET: 'payload-1234567890123456789012345',
  MAIL_HOST: 'smtp.example',
  MAIL_USER: 'mailer@example.test',
  MAIL_PASS: 'mail-password-value',
  MAIL_FROM: 'mailer@example.test',
  MAIL_TLS_REJECT_UNAUTHORIZED: 'true',
  ALLOWED_ORIGINS: 'https://cmms.example',
  PROCESSOR_API_URL: 'https://processor.example',
  PROCESSOR_API_TOKEN: 'processor-service-token',
  S3_BUCKET: 'cmms-test-uploads',
  S3_REGION: 'ap-south-1',
  MALWARE_SCAN_ENABLED: 'true',
  MALWARE_SCAN_URL: 'https://scanner.example/scan',
  REDIS_ENABLED: 'true',
  REDIS_URL: 'rediss://:12345678901234567890123456789012@redis.example:6379',
  QUEUE_ENABLED: 'true',
  UPLOAD_TENANT_QUOTA_BYTES: '1073741824',
  OTEL_ENABLED: 'true',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'https://telemetry.example/v1/traces',
  METRICS_TOKEN: 'metrics-1234567890123456789012345'
};

const importConfiguration = (overrides: Record<string, string>) =>
  spawnSync(
    process.execPath,
    ['--import', 'tsx', '--eval', "import('./src/configDB.ts')"],
    {
      cwd: process.cwd(),
      env: { ...productionEnvironment, ...overrides },
      encoding: 'utf8'
    }
  );

describe('production configuration validation', () => {
  it('rejects instance-local production storage', () => {
    const result = importConfiguration({ STORAGE_DRIVER: 'local' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Instance-local storage is not allowed');
  }, 20_000);

  it('accepts the required S3 and malware-scanning controls', () => {
    const result = importConfiguration({ STORAGE_DRIVER: 's3' });
    expect(`${result.stdout}${result.stderr}`).toBe('');
    expect(result.status).toBe(0);
  }, 20_000);

  it('requires an explicit legacy origin for the time-boxed S3 dual-read fallback', () => {
    const rejected = importConfiguration({
      STORAGE_DRIVER: 's3',
      S3_DUAL_READ_LOCAL_FALLBACK_ENABLED: 'true'
    });
    expect(rejected.status).not.toBe(0);
    expect(`${rejected.stdout}${rejected.stderr}`)
      .toContain('S3_DUAL_READ_LOCAL_BASE_URL is required');

    const accepted = importConfiguration({
      STORAGE_DRIVER: 's3',
      S3_DUAL_READ_LOCAL_FALLBACK_ENABLED: 'true',
      S3_DUAL_READ_LOCAL_BASE_URL: 'https://api.example'
    });
    expect(accepted.status).toBe(0);
  }, 20_000);

  it('rejects a missing or invalid production tenant upload quota', () => {
    const missing = importConfiguration({
      STORAGE_DRIVER: 's3',
      UPLOAD_TENANT_QUOTA_BYTES: ''
    });
    expect(missing.status).not.toBe(0);
    expect(`${missing.stdout}${missing.stderr}`)
      .toContain('UPLOAD_TENANT_QUOTA_BYTES is required');

    const invalid = importConfiguration({
      STORAGE_DRIVER: 's3',
      UPLOAD_TENANT_QUOTA_BYTES: '0'
    });
    expect(invalid.status).not.toBe(0);
    expect(`${invalid.stdout}${invalid.stderr}`)
      .toContain('must be a positive integer');
  }, 20_000);

  it('rejects production coordination without TLS Redis', () => {
    const result = importConfiguration({
      STORAGE_DRIVER: 's3',
      REDIS_URL: 'redis://redis.example:6379'
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('REDIS_URL must use TLS');
  }, 20_000);

  it('rejects durable domain events when BullMQ is disabled', () => {
    const result = importConfiguration({
      STORAGE_DRIVER: 's3',
      QUEUE_ENABLED: 'false',
      DOMAIN_EVENT_OUTBOX_ENABLED: 'true'
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`)
      .toContain('DOMAIN_EVENT_OUTBOX_ENABLED requires QUEUE_ENABLED');
  }, 20_000);

  it('rejects disabling the transactional outbox in production', () => {
    const result = importConfiguration({
      STORAGE_DRIVER: 's3',
      DOMAIN_EVENT_OUTBOX_ENABLED: 'false'
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`)
      .toContain('transactional domain-event outbox must be enabled');
  }, 20_000);

  it('requires an isolated processor service credential in production', () => {
    const missingUrl = importConfiguration({
      STORAGE_DRIVER: 's3',
      PROCESSOR_API_URL: ''
    });
    expect(missingUrl.status).not.toBe(0);
    expect(`${missingUrl.stdout}${missingUrl.stderr}`)
      .toContain('PROCESSOR_API_URL is required');

    const missingToken = importConfiguration({
      STORAGE_DRIVER: 's3',
      PROCESSOR_API_TOKEN: ''
    });
    expect(missingToken.status).not.toBe(0);
    expect(`${missingToken.stdout}${missingToken.stderr}`)
      .toContain('PROCESSOR_API_TOKEN is required');
  }, 20_000);

  it('requires distinct production signing secrets', () => {
    const missing = importConfiguration({
      STORAGE_DRIVER: 's3',
      REFRESH_TOKEN_SECRET: ''
    });
    expect(missing.status).not.toBe(0);
    expect(`${missing.stdout}${missing.stderr}`)
      .toContain('REFRESH_TOKEN_SECRET is required');

    const reused = importConfiguration({
      STORAGE_DRIVER: 's3',
      REFRESH_TOKEN_SECRET: productionEnvironment.AUTH_SECRET
    });
    expect(reused.status).not.toBe(0);
    expect(`${reused.stdout}${reused.stderr}`)
      .toContain('secrets must be distinct');
  }, 20_000);

  it('requires payload sealing material when production crypto is enabled', () => {
    const result = importConfiguration({
      STORAGE_DRIVER: 's3',
      PAYLOAD_CRYPTO_MASTER_SECRET: ''
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`)
      .toContain('PAYLOAD_CRYPTO_MASTER_SECRET is required');
  }, 20_000);

  it('requires SMTP certificate verification in production', () => {
    const result = importConfiguration({
      STORAGE_DRIVER: 's3',
      MAIL_TLS_REJECT_UNAUTHORIZED: 'false'
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`)
      .toContain('SMTP certificate verification cannot be disabled');
  }, 20_000);

  it('requires OpenTelemetry export in production', () => {
    const result = importConfiguration({
      STORAGE_DRIVER: 's3',
      OTEL_ENABLED: 'false'
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`)
      .toContain('OpenTelemetry must be enabled');
  }, 20_000);

  it('requires a strong production metrics scrape credential', () => {
    const missing = importConfiguration({
      STORAGE_DRIVER: 's3',
      METRICS_TOKEN: ''
    });
    expect(missing.status).not.toBe(0);
    expect(`${missing.stdout}${missing.stderr}`)
      .toContain('METRICS_TOKEN is required');

    const weak = importConfiguration({
      STORAGE_DRIVER: 's3',
      METRICS_TOKEN: 'short'
    });
    expect(weak.status).not.toBe(0);
    expect(`${weak.stdout}${weak.stderr}`)
      .toContain('METRICS_TOKEN must contain at least 32 characters');
  }, 20_000);
});
