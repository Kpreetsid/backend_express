const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10000;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalizeBaseUrl = (value) => {
  if (!value || !String(value).trim()) {
    throw new Error('CMMS_SMOKE_BASE_URL is required');
  }

  const parsed = new URL(String(value).trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('CMMS_SMOKE_BASE_URL must use http or https');
  }

  return parsed.toString().replace(/\/+$/, '');
};

const fetchJson = async (url, timeoutMs, fetchImpl) => {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'x-request-id': `deployment-smoke-${Date.now()}`
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${url} did not return JSON`);
  }

  const body = await response.json();
  if (body?.status !== 'ok') {
    throw new Error(`${url} returned status ${String(body?.status)}`);
  }
  const requestId = response.headers.get('x-request-id');
  if (!requestId) {
    throw new Error(`${url} did not propagate X-Request-ID`);
  }

  return {
    status: response.status,
    requestId,
    body
  };
};

const runApiSmoke = async ({
  baseUrl,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  wait = sleep
}) => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A Fetch API implementation is required');
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('Smoke attempts must be a positive integer');
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const live = await fetchJson(
        `${normalizedBaseUrl}/health/live`,
        timeoutMs,
        fetchImpl
      );
      const ready = await fetchJson(
        `${normalizedBaseUrl}/health/ready`,
        timeoutMs,
        fetchImpl
      );

      return {
        checkedAt: new Date().toISOString(),
        baseUrl: normalizedBaseUrl,
        attempt,
        live,
        ready
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(delayMs);
    }
  }

  throw new Error(
    `API deployment smoke failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
};

const main = async () => {
  const evidence = await runApiSmoke({
    baseUrl: process.env.CMMS_SMOKE_BASE_URL,
    attempts: Number(process.env.CMMS_SMOKE_ATTEMPTS || DEFAULT_ATTEMPTS),
    delayMs: Number(process.env.CMMS_SMOKE_DELAY_MS || DEFAULT_DELAY_MS),
    timeoutMs: Number(process.env.CMMS_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeBaseUrl,
  runApiSmoke
};
