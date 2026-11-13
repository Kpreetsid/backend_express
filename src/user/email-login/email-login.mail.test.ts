import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { MailerService } from '../../_config/mailer';
import { MailLogModel } from '../../models/mailLog.model';
import { emailLoginService, CreateEmailLoginInput } from './email-login.service';

for (const fail of [false, true]) {
  test(`work-order email ${fail ? 'failure revokes credential' : 'delivers recipient link'} without logging it`, async t => {
    const previous = process.env.EMAIL_LOGIN_ENABLED;
    process.env.EMAIL_LOGIN_ENABLED = 'true';
    t.after(() => { if (previous === undefined) delete process.env.EMAIL_LOGIN_ENABLED; else process.env.EMAIL_LOGIN_ENABLED = previous; });
    const secret = 'sensitive-email-credential';
    let logged: any;
    let delivered: any;
    t.mock.method(nodemailer, 'createTransport', (() => ({ async verify() {}, async sendMail(mail: any) {
      delivered = mail;
      if (fail) throw Error(secret);
      return { messageId: secret, response: secret };
    } })) as any);
    t.mock.method(MailLogModel.prototype, 'save', async function(this: any) { logged = this.toObject(); return this; });
    const issue = t.mock.method(emailLoginService, 'createEmailLoginLink', async (input: CreateEmailLoginInput) => {
      assert.equal(input.userId, 'recipient'); assert.equal(input.accountId, 'tenant');
      assert.equal(input.destination, '/work-order/details/order?source=email');
      return { url: `https://example.test/email-login#token=${secret}`, expiresAt: new Date(), credentialId: 'credential' };
    });
    const revoke = t.mock.method(emailLoginService, 'revokeCredential', async () => {});
    const request = new MailerService().sendWorkOrderMail({ _id: 'order', title: 'Work', order_no: 'WO1' },
      { _id: 'recipient', account_id: 'tenant', email: 'recipient@example.test' }, {});
    if (fail) await assert.rejects(request); else await request;
    assert.equal(issue.mock.callCount(), 1);
    assert.equal(delivered.to, 'recipient@example.test');
    assert.ok(delivered.html.includes(secret));
    assert.ok(!JSON.stringify(logged).includes(secret));
    assert.equal(revoke.mock.callCount(), fail ? 1 : 0);
  });
}
