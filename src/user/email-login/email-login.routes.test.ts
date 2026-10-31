import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import * as auth from '../../_config/auth';
import * as sessions from '../authentication/authentication.service';
import { registerEmailLoginRoutes } from './email-login.routes';
import { emailLoginService } from './email-login.service';
import { EmailLoginCredentialModel } from './email-login.model';

test('exchange delegates validated identity to the existing session flow and errors are no-store', async t => {
  const userId = '63a1492110c33e75c8232931';
  const accountId = '63a1492110c33e75c8232932';
  t.mock.method(emailLoginService, 'exchange', async (token: unknown) => {
    if (token !== 'test-credential') throw Object.assign(new Error('Invalid link'), { status: 410 });
    return { user: { _id: userId, account_id: accountId, email: 'test@example.test' }, redirectPath: '/parts' };
  });
  t.mock.method(sessions, 'establishExternalSession', async (_req: any, res: any, _next: any, decoded: any) => {
    assert.deepEqual(decoded, { email: 'test@example.test', org_id: accountId, userId,
      isExternal: false, isInternal: true, redirectPath: '/parts' });
    return res.json({ status: true, data: { authMethod: 'cookie', redirectPath: '/parts' } });
  });
  const app = express(); app.use(express.json()); registerEmailLoginRoutes(app);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ status: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/users/email-login`;
  const request = (token: string) => fetch(`${base}/exchange`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  const success = await request('test-credential');
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await success.json(), { status: true, data: { authMethod: 'cookie', redirectPath: '/parts' } });
  const failure = await request('bad');
  assert.equal(failure.status, 410);
  assert.equal(failure.headers.get('cache-control'), 'no-store');
});

test('credential management loads current identity and rejects cross-user access', async t => {
  t.mock.method(auth, 'isAuthenticated', async (req: any, _res: any, next: any) => {
    req.user = { _id: 'user-1', account_id: 'account-1', user_role: 'employee' }; next();
  });
  t.mock.method(EmailLoginCredentialModel, 'findOne', () => ({ lean: async () => ({ userId: 'user-2', accountId: 'account-1' }) }));
  const revoke = t.mock.method(emailLoginService, 'revokeCredential');
  const app = express(); app.use(express.json()); registerEmailLoginRoutes(app);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ status: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/users/email-login`;
  const response = await fetch(`${base}/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId: 'other-user-link' }) });
  assert.equal(response.status, 404);
  assert.equal(revoke.mock.callCount(), 0);
  assert.equal((await fetch(`${base}/credentials?userId=user-2`)).status, 403);
});
