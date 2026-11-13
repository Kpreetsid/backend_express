import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import { MailerService } from '../../_config/mailer';
import { MailLogModel } from '../../models/mailLog.model';
import { verificationChallenges } from './verification-challenge.service';

test('OTP email sends the code but never persists delivery content or responses in mail logs', async t => {
  const otp = '123456';
  let delivered = '';
  let logged: any;
  t.mock.method(verificationChallenges, 'issueOtp', async (_user: any, purpose: string) => { assert.equal(purpose, 'password-reset'); return otp; });
  t.mock.method(nodemailer, 'createTransport', (() => ({ async verify() {}, async sendMail(mail: any) {
    delivered = mail.html; return { messageId: otp, response: otp, accepted: [otp] };
  } })) as any);
  t.mock.method(MailLogModel.prototype, 'save', async function(this: any) { logged = this.toObject(); return this; });
  const service = new MailerService();
  assert.equal(await service.sendVerificationCode({ email: 'test@example.com', firstName: 'Test' }, 'password-reset'), true);
  assert.ok(delivered.includes(otp));
  assert.ok(!JSON.stringify(logged).includes(otp));
  assert.equal(logged.html, '[Verification content redacted]');
});

test('failed OTP delivery discards only that issued challenge and redacts transport errors', async t => {
  let discarded = false;
  let logged: any;
  t.mock.method(verificationChallenges, 'issueOtp', async () => '123456');
  t.mock.method(verificationChallenges, 'discardOtp', async (email: string, otp: string, purpose: string) => {
    assert.equal(email, 'test@example.com'); assert.equal(otp, '123456'); assert.equal(purpose, 'registration'); discarded = true;
  });
  t.mock.method(nodemailer, 'createTransport', (() => ({ async verify() { throw new Error('123456'); } })) as any);
  t.mock.method(MailLogModel.prototype, 'save', async function(this: any) { logged = this.toObject(); return this; });
  const messages: any[] = [];
  t.mock.method(console, 'error', (...args: any[]) => { messages.push(args); });
  assert.equal(await new MailerService().sendVerificationCode({ email: 'test@example.com', firstName: 'Test' }, 'registration'), false);
  assert.equal(discarded, true);
  assert.ok(!JSON.stringify([logged, messages]).includes('123456'));
});
