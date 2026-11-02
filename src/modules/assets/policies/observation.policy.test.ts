import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeObservationCreatePayload } from './observation.policy';

const accountId = '64a000000000000000000001';
const payload = {
  observation: '<p>Alarm reviewed</p>', recommendation: '<p>Inspect equipment</p>', status: 'Alert',
  assetId: '64a000000000000000000002', locationId: '64a000000000000000000003',
  top_level_asset_id: '64a000000000000000000002', alarmId: 42
};

test('alarm observation sanitization retains both boolean alarm states for persistence and processor forwarding', () => {
  for (const alarmStatus of [true, false]) {
    const sanitized = sanitizeObservationCreatePayload({ ...payload, alarmStatus }, accountId);
    assert.equal(sanitized.alarmStatus, alarmStatus);
    assert.equal(sanitized.alarmId, 42);
  }
});

test('alarm observation sanitization rejects nonboolean alarm states', () => {
  for (const alarmStatus of ['true', 'false', 1, 0, null, {}, []]) {
    assert.throws(() => sanitizeObservationCreatePayload({ ...payload, alarmStatus }, accountId),
      (error: any) => error.status === 400 && /Alarm status/.test(error.message));
  }
});

test('omitted alarm state stays absent for legacy observation requests', () => {
  assert.equal(Object.hasOwn(sanitizeObservationCreatePayload(payload, accountId), 'alarmStatus'), false);
});
