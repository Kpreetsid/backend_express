import test from 'node:test';
import assert from 'node:assert/strict';
import { isMonitoringClient, requireMonitoringClient } from './health.routes';

test('monitoring is denied by default and ignores forwarded spoofing', () => {
  assert.equal(isMonitoringClient('127.0.0.1', ''), false);
  assert.equal(isMonitoringClient('127.0.0.1', '127.0.0.1'), true);
  assert.equal(isMonitoringClient('203.0.113.1', '127.0.0.1'), false);
  let result = 0;
  const req = { socket: { remoteAddress: '203.0.113.1' }, headers: { 'x-forwarded-for': '127.0.0.1' } } as any;
  const res = { status(code: number) { result = code; return this; }, json() { return this; } } as any;
  requireMonitoringClient(req, res, () => { result = 200; });
  assert.equal(result, 404);
});
