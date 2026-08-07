const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeBaseUrl, runApiSmoke } = require('./smoke-api-deployment.cjs');

const jsonResponse = (status, body, headers = {}) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  }
);

test('normalizes and validates the deployment origin', () => {
  assert.equal(normalizeBaseUrl('https://cmms.example.test/'), 'https://cmms.example.test');
  assert.throws(() => normalizeBaseUrl('file:///tmp/cmms'), /http or https/);
  assert.throws(() => normalizeBaseUrl(''), /required/);
});

test('checks both liveness and readiness and returns evidence', async () => {
  const requested = [];
  const evidence = await runApiSmoke({
    baseUrl: 'https://cmms.example.test/',
    attempts: 1,
    fetchImpl: async (url) => {
      requested.push(url);
      return jsonResponse(200, { status: 'ok' }, { 'x-request-id': 'request-1' });
    }
  });

  assert.deepEqual(requested, [
    'https://cmms.example.test/health/live',
    'https://cmms.example.test/health/ready'
  ]);
  assert.equal(evidence.attempt, 1);
  assert.equal(evidence.ready.requestId, 'request-1');
});

test('retries a degraded target and fails closed when it never becomes ready', async () => {
  let calls = 0;
  let waits = 0;

  await assert.rejects(
    runApiSmoke({
      baseUrl: 'https://cmms.example.test',
      attempts: 3,
      delayMs: 1,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(503, { status: 'degraded' });
      },
      wait: async () => {
        waits += 1;
      }
    }),
    /failed after 3 attempts/
  );

  assert.equal(calls, 3);
  assert.equal(waits, 2);
});
