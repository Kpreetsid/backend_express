const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateCapacityResult,
  percentile,
  positiveInteger
} = require('./enterprise-capacity.cjs');

test('computes deterministic nearest-rank percentiles', () => {
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([40, 10, 30, 20], 50), 20);
  assert.equal(percentile([40, 10, 30, 20], 95), 40);
});

test('validates positive capacity inputs', () => {
  assert.equal(positiveInteger(undefined, 250, 'rate'), 250);
  assert.equal(positiveInteger('2000', 1, 'sockets'), 2000);
  assert.throws(() => positiveInteger('0', 1, 'rate'), /positive integer/);
});

test('accepts a capacity result inside the SLO envelope', () => {
  const failures = evaluateCapacityResult({
    http: { scheduled: 1000, completed: 1000, failures: 5, p95Ms: 450 },
    sockets: { requested: 2000, failures: 10 }
  }, { maximumErrorRate: 0.01, maximumP95Ms: 500 });
  assert.deepEqual(failures, []);
});

test('reports generator, error-rate, latency, and socket failures independently', () => {
  const failures = evaluateCapacityResult({
    http: { scheduled: 1000, completed: 900, failures: 20, p95Ms: 700 },
    sockets: { requested: 2000, failures: 25 }
  }, { maximumErrorRate: 0.01, maximumP95Ms: 500 });
  assert.equal(failures.length, 4);
  assert.match(failures.join(' '), /95%.*HTTP error rate.*p95.*Socket connection error rate/);
});
