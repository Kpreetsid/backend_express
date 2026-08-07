const { performance } = require('node:perf_hooks');
const { io } = require('socket.io-client');

const positiveInteger = (value, fallback, name) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const percentile = (values, percentage) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentage / 100) * sorted.length) - 1);
  return sorted[index];
};

const evaluateCapacityResult = (result, limits) => {
  const failures = [];
  const httpFailureRate = result.http.completed
    ? result.http.failures / result.http.completed
    : 1;
  const socketFailureRate = result.sockets.requested
    ? result.sockets.failures / result.sockets.requested
    : 0;

  if (result.http.completed < Math.floor(result.http.scheduled * 0.95)) {
    failures.push('HTTP generator completed less than 95% of scheduled requests');
  }
  if (httpFailureRate >= limits.maximumErrorRate) {
    failures.push(`HTTP error rate ${(httpFailureRate * 100).toFixed(2)}% exceeded the limit`);
  }
  if (result.http.p95Ms > limits.maximumP95Ms) {
    failures.push(`HTTP p95 ${result.http.p95Ms.toFixed(2)}ms exceeded ${limits.maximumP95Ms}ms`);
  }
  if (socketFailureRate >= limits.maximumErrorRate) {
    failures.push(`Socket connection error rate ${(socketFailureRate * 100).toFixed(2)}% exceeded the limit`);
  }
  return failures;
};

const connectSocket = (baseUrl, auth, timeoutMs) => new Promise((resolve) => {
  const socket = io(baseUrl, {
    auth,
    transports: ['websocket'],
    reconnection: false,
    timeout: timeoutMs
  });
  let settled = false;
  const finish = (connected, error) => {
    if (settled) return;
    settled = true;
    socket.off('connect', onConnect);
    socket.off('connect_error', onError);
    resolve({ socket, connected, error: error?.message });
  };
  const onConnect = () => finish(true);
  const onError = (error) => finish(false, error);
  socket.once('connect', onConnect);
  socket.once('connect_error', onError);
});

const run = async (environment = process.env) => {
  const baseUrl = new URL(String(environment.CMMS_LOAD_BASE_URL || ''));
  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error('CMMS_LOAD_BASE_URL must use HTTP or HTTPS');
  }
  const method = String(environment.CMMS_LOAD_HTTP_METHOD || 'GET').toUpperCase();
  const requestPath = String(environment.CMMS_LOAD_HTTP_PATH || '/health/ready');
  const requestsPerSecond = positiveInteger(
    environment.CMMS_LOAD_REQUESTS_PER_SECOND,
    250,
    'CMMS_LOAD_REQUESTS_PER_SECOND'
  );
  const socketConnections = positiveInteger(
    environment.CMMS_LOAD_SOCKET_CONNECTIONS,
    2000,
    'CMMS_LOAD_SOCKET_CONNECTIONS'
  );
  const durationSeconds = positiveInteger(
    environment.CMMS_LOAD_DURATION_SECONDS,
    60,
    'CMMS_LOAD_DURATION_SECONDS'
  );
  const timeoutMs = positiveInteger(
    environment.CMMS_LOAD_TIMEOUT_MS,
    5000,
    'CMMS_LOAD_TIMEOUT_MS'
  );
  const token = String(environment.CMMS_LOAD_BEARER_TOKEN || '');
  const accountId = String(environment.CMMS_LOAD_ACCOUNT_ID || '');
  if (socketConnections > 0 && (!token || !accountId)) {
    throw new Error('Socket capacity testing requires CMMS_LOAD_BEARER_TOKEN and CMMS_LOAD_ACCOUNT_ID');
  }

  const requestUrl = new URL(requestPath, baseUrl);
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (accountId) headers.accountID = accountId;
  const body = environment.CMMS_LOAD_HTTP_BODY
    ? String(environment.CMMS_LOAD_HTTP_BODY)
    : undefined;
  if (body) headers['Content-Type'] = 'application/json';

  const latencies = [];
  let scheduled = 0;
  let completed = 0;
  let failures = 0;
  const requests = new Set();
  const requestIntervalMs = 1000 / requestsPerSecond;
  const startedAt = performance.now();
  const stopAt = startedAt + durationSeconds * 1000;

  const scheduleRequest = () => {
    scheduled += 1;
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const current = fetch(requestUrl, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : body,
      signal: controller.signal
    }).then((response) => {
      if (response.status >= 500) failures += 1;
      return response.arrayBuffer();
    }).catch(() => {
      failures += 1;
    }).finally(() => {
      clearTimeout(timeout);
      completed += 1;
      latencies.push(performance.now() - started);
      requests.delete(current);
    });
    requests.add(current);
  };

  const interval = setInterval(() => {
    if (performance.now() >= stopAt) return;
    scheduleRequest();
  }, requestIntervalMs);

  const sockets = [];
  let socketFailures = 0;
  const socketBatchSize = 100;
  for (let offset = 0; offset < socketConnections; offset += socketBatchSize) {
    const batchSize = Math.min(socketBatchSize, socketConnections - offset);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, () => connectSocket(baseUrl.href, {
        token,
        accountId
      }, timeoutMs))
    );
    for (const connection of batch) {
      sockets.push(connection.socket);
      if (!connection.connected) socketFailures += 1;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, Math.max(0, stopAt - performance.now())));
  clearInterval(interval);
  await Promise.allSettled([...requests]);
  sockets.forEach((socket) => socket.disconnect());

  const result = {
    schemaVersion: 1,
    target: {
      origin: baseUrl.origin,
      path: requestUrl.pathname,
      method,
      durationSeconds,
      requestsPerSecond,
      socketConnections
    },
    http: {
      scheduled,
      completed,
      failures,
      errorRate: completed ? failures / completed : 1,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      p99Ms: percentile(latencies, 99)
    },
    sockets: {
      requested: socketConnections,
      connected: socketConnections - socketFailures,
      failures: socketFailures,
      errorRate: socketConnections ? socketFailures / socketConnections : 0
    },
    completedAt: new Date().toISOString()
  };
  const limits = {
    maximumErrorRate: 0.01,
    maximumP95Ms: ['GET', 'HEAD'].includes(method) ? 500 : 1000
  };
  const gateFailures = evaluateCapacityResult(result, limits);
  return { result, gateFailures };
};

if (require.main === module) {
  run().then(({ result, gateFailures }) => {
    process.stdout.write(`${JSON.stringify({ ...result, gateFailures }, null, 2)}\n`);
    if (gateFailures.length) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { evaluateCapacityResult, percentile, positiveInteger };
