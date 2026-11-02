import assert from 'node:assert/strict';
import test from 'node:test';
import { mongoSanitizeMiddleware } from './mongo-sanitize.middleware';

test('request sanitization rejects Mongo operators and dotted keys at every nesting level', () => {
  const req: any = {
    body: { title: 'Pump', 'profile.isAdmin': true, nested: [{ $where: 'unsafe', 'a.b': 1, safe: 'value' }] },
    params: { id: 'valid', 'account.id': 'foreign' },
    query: { $ne: null, name: 'Pump' }
  };
  let calls = 0;
  mongoSanitizeMiddleware()(req, {} as any, () => { calls++; });
  assert.equal(calls, 1);
  assert.deepEqual(req.body, { title: 'Pump', nested: [{ safe: 'value' }] });
  assert.deepEqual(req.params, { id: 'valid' });
  assert.deepEqual(req.query, { name: 'Pump' });
});
