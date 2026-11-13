import test from 'node:test';
import assert from 'node:assert/strict';
import { createTwoStepService } from './two-step.service';
import type { TwoStepRecord, TwoStepStore } from './two-step.model';
import { createTwoStepMailer } from './two-step.mail';

function fixture() {
  let now = Date.parse('2026-11-13T00:00:00Z');
  let row: TwoStepRecord | null = null;
  let rejectMail = false;
  const user = { _id: '63a1492110c33e75c8232931', account_id: '63a1492110c33e75c8232932',
    email: 'user@example.test', password: 'isolated-password-digest', user_status: 'active', isVerified: true };
  const account = { _id: user.account_id, visible: true, account_status: 'active',
    two_step_auth_enabled: true, two_step_auth_revision: 1 };
  const matches = (filter: Record<string, unknown>) => !!row && Object.entries(filter).every(([key, expected]) => {
    const actual = (row as any)[key];
    if (expected && typeof expected === 'object') return Object.entries(expected).every(([op, value]) =>
      op === '$gt' ? +actual > +(value as any) : op === '$lt' ? +actual < +(value as any) : op === '$lte' && +actual <= +(value as any));
    return actual === expected;
  });
  const store: TwoStepStore = {
    async initialize(initial) { if (!row) row = structuredClone(initial); },
    async read(filter) { return matches(filter) ? structuredClone(row) : null; },
    async compareAndSet(filter, next) { if (!matches(filter)) return false; row = structuredClone(next); return true; }
  };
  const deliveries: string[] = [];
  const service = createTwoStepService({ store, now: () => now, secret: () => 's'.repeat(32), randomCode: () => '0427',
    loadUser: async () => user, loadAccount: async () => account,
    send: async (_email, code) => { if (rejectMail) throw Error('isolated delivery failure'); deliveries.push(code); } });
  return { service, user, account, deliveries, row: () => row!, advance: (ms: number) => { now += ms; },
    failMail: () => { rejectMail = true; }, issue: () => service.issue(user, account, 'login', now) };
}

test('two-step retains only digests and consumes exactly once under concurrent verification', async () => {
  const f = fixture(); const issued = await f.issue();
  assert.equal(issued.twoStepRequired, true);
  assert.deepEqual(f.deliveries, ['0427']);
  assert.equal(JSON.stringify(f.row()).includes(issued.challengeToken), false);
  assert.equal(JSON.stringify(f.row()).includes('0427'), false);
  const results = await Promise.allSettled([f.service.consume(issued.challengeToken, '0427'), f.service.consume(issued.challengeToken, '0427')]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(f.row().deliveryState, 'consumed');
  await assert.rejects(f.service.consume(issued.challengeToken, '0427'), { code: 'TWO_STEP_INVALID' });
});

test('two-step rejects malformed input, expiry, policy changes and changed credentials', async t => {
  for (const scenario of ['expiry', 'policy', 'password', 'email', 'tenant', 'inactive'] as const) {
    await t.test(scenario, async () => {
      const f = fixture(); const issued = await f.issue();
      if (scenario === 'expiry') f.advance(5 * 60_000);
      if (scenario === 'policy') f.account.two_step_auth_revision++;
      if (scenario === 'password') f.user.password = 'changed-digest';
      if (scenario === 'email') f.user.email = 'changed@example.test';
      if (scenario === 'tenant') f.user.account_id = '63a1492110c33e75c8232999';
      if (scenario === 'inactive') f.account.two_step_auth_enabled = false;
      await assert.rejects(f.service.consume(issued.challengeToken, '0427'), { code: 'TWO_STEP_INVALID' });
    });
  }
  const f = fixture();
  await assert.rejects(f.service.consume({}, '0427'), { code: 'TWO_STEP_MALFORMED' });
  await assert.rejects(f.service.consume('a'.repeat(43), 427), { code: 'TWO_STEP_MALFORMED' });
});

test('resend enforces cooldown, rotates challenge and preserves the guess budget', async () => {
  const f = fixture(); const issued = await f.issue();
  await assert.rejects(f.service.resend(issued.challengeToken), { code: 'TWO_STEP_RATE_LIMITED' });
  await assert.rejects(f.service.consume(issued.challengeToken, '1111'), { code: 'TWO_STEP_CODE_INVALID' });
  f.advance(60_000); const next = await f.service.resend(issued.challengeToken);
  assert.notEqual(next.challengeToken, issued.challengeToken);
  await assert.rejects(f.service.consume(issued.challengeToken, '0427'), { code: 'TWO_STEP_INVALID' });
  for (let attempt = 0; attempt < 4; attempt++) await assert.rejects(f.service.consume(next.challengeToken, '1111'),
    { code: attempt === 3 ? 'TWO_STEP_INVALID' : 'TWO_STEP_CODE_INVALID' });
  await assert.rejects(f.service.consume(next.challengeToken, '0427'), { code: 'TWO_STEP_INVALID' });
  await assert.rejects(f.issue(), { code: 'TWO_STEP_RATE_LIMITED' });
});

test('failed delivery leaves no redeemable challenge and no code digest', async () => {
  const f = fixture(); f.failMail();
  await assert.rejects(f.issue(), { code: 'TWO_STEP_UNAVAILABLE' });
  assert.equal(f.row().deliveryState, 'invalid');
  assert.equal(f.row().codeDigest, null);
});

test('two-step mail uses the template, requires TLS and redacts transport errors', async () => {
  let options: any; let payload: any;
  const mailer = createTwoStepMailer(value => { options = value; return { async sendMail(message) {
    payload = message; return { accepted: ['user@example.test'], rejected: [] };
  } }; });
  await mailer.send('user@example.test', '0427');
  assert.equal(options.requireTLS, true); assert.equal(options.tls.rejectUnauthorized, true);
  assert.equal(options.logger, false); assert.equal(options.disableFileAccess, true);
  assert.match(payload.html, /0427/); assert.match(payload.text, /0427/);
  const failing = createTwoStepMailer(() => ({ async sendMail() { throw Error('sensitive SMTP details'); } }));
  await assert.rejects(failing.send('user@example.test', '0427'), error =>
    (error as any).code === 'TWO_STEP_UNAVAILABLE' && !(error as Error).message.includes('sensitive'));
});
