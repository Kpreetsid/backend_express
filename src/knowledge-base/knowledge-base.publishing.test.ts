import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';
import { Types } from 'mongoose';
import { KnowledgeBaseGuideModel } from './knowledge-base.model';
import { guideRolePermissions, isGuidePublishingBearerRequest, verifyGuidePublisher } from './knowledge-base.publisher-auth';
import { guidePublishingRoutes } from './knowledge-base.publishing.routes';
import { guidePublishingService, guideInput, validateGuidePdf } from './knowledge-base.publishing.service';
import { knowledgeBaseRoutes } from './knowledge-base.routes';
import { csrfProtection } from '../middlewares/csrf.middleware';
import { cookieAuth } from '../configDB';

const userId = '64a000000000000000000001';
const guideId = '64a000000000000000000002';
const token = jwt.sign({ userId, username: 'internal-admin', role: 'admin' }, 'test-only-secret', { expiresIn: '1h' });
const admin = { _id: userId, user_role: 'admin', user_status: 'active', visible: true };
const allPermissions = { view: true, add: true, edit: true, delete: true };
const enabledMenu = { master_knowledge_base: { view: true }, knowledge_base: allPermissions };
const roleRecord = (role: string, roleMenu: any = enabledMenu) => ({ userId, roleName: role, visible: true, roleMenu });
const input = { title: ' Installation guide ', description: 'Mount a sensor.', category: 'sensor-installation', published: false };
const pdf = { originalname: 'guide.pdf', buffer: Buffer.from('%PDF-1.4\nfixture\n%%EOF') } as Express.Multer.File;
const tempRoot = async () => fs.mkdtemp(path.join(os.tmpdir(), 'guide-publishing-test-'));
const clean = async (root: string) => {
  const target = path.resolve(root);
  assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.ok(path.basename(target).startsWith('guide-publishing-test-'));
  await fs.rm(target, { recursive: true, force: true });
};
function setRoot(root: string): () => void {
  const previous = process.env.KNOWLEDGE_BASE_FILES_DIR;
  process.env.KNOWLEDGE_BASE_FILES_DIR = root;
  return () => { if (previous === undefined) { delete process.env.KNOWLEDGE_BASE_FILES_DIR; } else { process.env.KNOWLEDGE_BASE_FILES_DIR = previous; } };
}

test('publishing uses the verified identity and current saved user permissions', async t => {
  let role = 'admin'; let roleMenu: any = enabledMenu;
  t.mock.method(axios, 'get', async (url: string, config: any) => {
    assert.equal(config.headers.Authorization, 'Bearer ' + token);
    assert.equal(config.headers['x-db-type'], 'production');
    if (url.endsWith('/api/internal/role-menu')) {
      assert.equal(config.params.user_id, userId);
      return { data: { status: true, data: [roleRecord(role, roleMenu)] } };
    }
    assert.equal(url, 'https://app.presageinsights.ai/internal_express/api/internal/users/' + userId);
    return { data: { status: true, data: { ...admin, user_role: role } } };
  });
  assert.deepEqual(await verifyGuidePublisher(token), { id: userId, permissions: allPermissions });
  role = 'employee'; roleMenu = { master_knowledge_base: { view: true }, knowledge_base: { view: true, add: true, edit: false, delete: false } };
  assert.deepEqual((await verifyGuidePublisher(token)).permissions, { view: true, add: true, edit: false, delete: false });
  role = 'admin'; roleMenu.master_knowledge_base.view = false;
  assert.deepEqual((await verifyGuidePublisher(token)).permissions, { view: false, add: false, edit: false, delete: false });
  await assert.rejects(verifyGuidePublisher(jwt.sign({ id: userId, companyID: guideId }, 'customer-secret')), { status: 401 });
});

test('legacy menus default to admin access and preserve explicit role denials', () => {
  assert.deepEqual(guideRolePermissions({}, 'admin'), allPermissions);
  assert.equal(guideRolePermissions({}, 'employee').view, false);
  assert.equal(guideRolePermissions({ master_knowledge_base: { view: false } }, 'admin').view, false);
  assert.equal(guideRolePermissions({ ...enabledMenu, knowledge_base: { view: true, add: false } }, 'admin').delete, false);
});

test('a missing or mismatched saved role cannot grant publishing access', async t => {
  t.mock.method(axios, 'get', async (url: string) => url.endsWith('/role-menu')
    ? { data: { status: true, data: [{ ...roleRecord('admin'), userId: guideId }] } }
    : { data: { status: true, data: admin } });
  await assert.rejects(verifyGuidePublisher(token), { status: 403 });
});

test('revoked or expired internal sessions fail closed', async t => {
  t.mock.method(axios, 'get', async () => { throw new axios.AxiosError('Rejected', undefined, undefined, undefined, { status: 401 } as any); });
  await assert.rejects(verifyGuidePublisher(token), { status: 401 });
});

test('internal verification outages are reported without revealing the token', async t => {
  t.mock.method(axios, 'get', async () => { throw new axios.AxiosError('network error'); });
  await assert.rejects(verifyGuidePublisher(token), (error: any) => error.status === 503 && !error.message.includes(token));
});

test('cookie-CSRF exemption is limited to publishing paths carrying bearer authentication', () => {
  const request = (pathname: string, bearer = true) => ({ path: pathname, get: () => bearer ? `Bearer ${token}` : undefined }) as unknown as express.Request;
  assert.equal(isGuidePublishingBearerRequest(request('/api/internal/knowledge-base/guides')), true);
  assert.equal(isGuidePublishingBearerRequest(request('/cmms_express/api/internal/knowledge-base/guides')), true);
  assert.equal(isGuidePublishingBearerRequest(request('/api/internal/knowledge-base/guides', false)), false);
  assert.equal(isGuidePublishingBearerRequest(request('/api/master/assets')), false);
});

test('guide metadata and binary PDF content are validated before storage', () => {
  assert.equal(guideInput(input).title, 'Installation guide');
  for (const payload of [{ ...input, title: ' ' }, { ...input, category: 'invalid' }, { ...input, published: 'invalid' }]) {
    assert.throws(() => guideInput(payload), { status: 400 });
  }
  assert.equal(validateGuidePdf(pdf), pdf);
  for (const file of [undefined, { ...pdf, originalname: 'guide.html' }, { ...pdf, buffer: Buffer.from('<html>not a PDF</html>') }]) {
    assert.throws(() => validateGuidePdf(file as any), { status: 400 });
  }
});

test('a failed database save removes the new file', async t => {
  const root = await tempRoot(); const reset = setRoot(root);
  t.mock.method(KnowledgeBaseGuideModel, 'create', async () => { throw new Error('database failed'); });
  try {
    await assert.rejects(guidePublishingService.create(input, pdf, userId));
    assert.deepEqual(await fs.readdir(root), []);
  } finally { reset(); await clean(root); }
});

test('a conflicting replacement preserves the previous PDF and cleans up the new one', async t => {
  const root = await tempRoot(); const reset = setRoot(root);
  await fs.writeFile(path.join(root, 'old.pdf'), pdf.buffer);
  const current = { ...input, _id: new Types.ObjectId(guideId), fileName: 'old.pdf', size: pdf.buffer.length, createdAt: new Date(), updatedAt: new Date() };
  t.mock.method(KnowledgeBaseGuideModel, 'findById', () => ({ lean: () => ({ exec: async () => current }) }));
  t.mock.method(KnowledgeBaseGuideModel, 'findOneAndUpdate', () => ({ lean: () => ({ exec: async () => null }) }));
  try {
    await assert.rejects(guidePublishingService.update(guideId, { ...input, updatedAt: current.updatedAt.toISOString() }, pdf, userId), { status: 409 });
    assert.deepEqual(await fs.readdir(root), ['old.pdf']);
  } finally { reset(); await clean(root); }
});

test('internal upload, publish, replace, and unpublish use the customer catalog and storage', async t => {
  const root = await tempRoot(); const reset = setRoot(root);
  let record: any;
  let clock = Date.now();
  const result = (value: () => any) => {
    const query = { sort: () => query, select: () => query, lean: () => query, exec: async () => value() };
    return query;
  };
  let roleMenu: any = enabledMenu;
  t.mock.method(axios, 'get', async (url: string) => ({ data: { status: true, data: url.endsWith('/role-menu') ? [roleRecord('admin', roleMenu)] : admin } }));
  t.mock.method(KnowledgeBaseGuideModel, 'create', async (data: any) => {
    record = { ...data, _id: new Types.ObjectId(guideId), createdAt: new Date(++clock), updatedAt: new Date(++clock) };
    return record;
  });
  t.mock.method(KnowledgeBaseGuideModel, 'find', (filter: any) => result(() =>
    record && (filter.published === undefined || record.published === filter.published) ? [record] : []));
  t.mock.method(KnowledgeBaseGuideModel, 'findById', () => result(() => record));
  t.mock.method(KnowledgeBaseGuideModel, 'findOne', (filter: any) => result(() => record?.published === filter.published ? record : null));
  t.mock.method(KnowledgeBaseGuideModel, 'findOneAndUpdate', (filter: any, update: any) => result(() => {
    if (!record || record.updatedAt.getTime() !== filter.updatedAt.getTime()) { return null; }
    record = { ...record, ...update.$set, updatedAt: new Date(++clock) }; return record;
  }));
  t.mock.method(KnowledgeBaseGuideModel, 'findOneAndDelete', (filter: any) => result(() => {
    if (!record || record.updatedAt.getTime() !== filter.updatedAt.getTime()) { return null; }
    const deleted = record; record = undefined; return deleted;
  }));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.cookies = { [cookieAuth.accessCookieName]: 'customer-cookie' }; next(); });
  app.use(csrfProtection);
  app.use('/api/internal/knowledge-base', guidePublishingRoutes());
  app.use('/api/knowledge-base', knowledgeBaseRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ status: false, message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { Authorization: `Bearer ${token}` };
  const customerCatalog = async () => (await (await fetch(`${base}/api/knowledge-base/guides`)).json() as any).data.guides;
  const form = (published: boolean, updatedAt?: string, contents = pdf.buffer.toString()) => {
    const data = new FormData();
    data.set('title', 'Sensor Installation'); data.set('description', 'Install the sensor.');
    data.set('category', 'sensor-installation'); data.set('published', String(published));
    if (updatedAt) { data.set('updatedAt', updatedAt); }
    data.set('file', new Blob([contents], { type: 'application/pdf' }), 'guide.pdf'); return data;
  };
  try {
    assert.equal((await fetch(`${base}/api/internal/knowledge-base/guides`)).status, 401);
    const created = await fetch(`${base}/api/internal/knowledge-base/guides`, { method:'POST',headers,body:form(false) });
    assert.equal(created.status, 201); let guide = (await created.json() as any).data;
    assert.equal(guide.published, false); assert.deepEqual(await customerCatalog(), []);
    const preview = await fetch(`${base}/api/internal/knowledge-base/guides/${guide.id}/file`, { headers });
    assert.equal(preview.status, 200); assert.match(await preview.text(), /^%PDF-/);
    const toggle = async (published: boolean) => {
      const response = await fetch(`${base}/api/internal/knowledge-base/guides/${guide.id}/visibility`, {
        method:'PATCH',headers:{ ...headers,'Content-Type':'application/json' },
        body:JSON.stringify({ published,updatedAt:guide.updatedAt })
      }); assert.equal(response.status,200); guide=(await response.json() as any).data;
    };
    await toggle(true); assert.equal((await customerCatalog()).length,1);
    const previousFile=record.fileName;
    const replacement=await fetch(`${base}/api/internal/knowledge-base/guides/${guide.id}`,{
      method:'PUT',headers,body:form(true,guide.updatedAt,'%PDF-1.4\nreplacement\n%%EOF')
    });
    assert.equal(replacement.status,200); guide=(await replacement.json() as any).data;
    assert.notEqual(record.fileName,previousFile); assert.equal((await fs.readdir(root)).length,1);
    const customerPdf=await fetch(`${base}/api/knowledge-base/guides/${guide.id}/file`);
    assert.match(await customerPdf.text(),/replacement/);
    await toggle(false); assert.deepEqual(await customerCatalog(),[]);
    assert.equal((await fetch(`${base}/api/knowledge-base/guides/${guide.id}/file`)).status,404);
    const bad=await fetch(`${base}/api/internal/knowledge-base/guides`,{method:'POST',headers,body:form(false,undefined,'<html>fake</html>')});
    assert.equal(bad.status,400); assert.equal((await fs.readdir(root)).length,1);
    roleMenu = { master_knowledge_base: { view: true }, knowledge_base: { view: true, add: false, edit: false, delete: false } };
    const restricted = await fetch(base + '/api/internal/knowledge-base/guides', { headers });
    assert.deepEqual((await restricted.json() as any).data.permissions, { view: true, add: false, edit: false, delete: false });
    assert.equal((await fetch(base + '/api/internal/knowledge-base/guides', { method: 'POST', headers, body: form(false) })).status, 403);
    const deleteRequest = (updatedAt: string) => fetch(base + '/api/internal/knowledge-base/guides/' + guide.id, {
      method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ updatedAt })
    });
    assert.equal((await deleteRequest(guide.updatedAt)).status, 403);
    const editRequest = await fetch(base + '/api/internal/knowledge-base/guides/' + guide.id + '/visibility', {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ published: true, updatedAt: guide.updatedAt })
    }); assert.equal(editRequest.status, 403);
    roleMenu = { ...roleMenu, master_knowledge_base: { view: false } };
    assert.equal((await fetch(base + '/api/internal/knowledge-base/guides', { headers })).status, 403);
    roleMenu = enabledMenu;
    assert.equal((await deleteRequest('2000-01-01T00:00:00Z')).status, 409);
    assert.equal((await fs.readdir(root)).length, 1);
    await toggle(true);
    assert.equal((await deleteRequest(guide.updatedAt)).status, 200);
    assert.deepEqual(await customerCatalog(), []);
    assert.equal((await fs.readdir(root)).length, 0);
    assert.equal((await fetch(base + '/api/internal/knowledge-base/guides/' + guide.id + '/file', { headers })).status, 404);
    assert.equal((await fetch(base + '/api/knowledge-base/guides/' + guide.id + '/file')).status, 404);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); reset();await clean(root);
  }
});

test('a database deletion failure preserves the guide PDF', async t => {
  const root = await tempRoot(); const reset = setRoot(root);
  await fs.writeFile(path.join(root, 'old.pdf'), pdf.buffer);
  const current = { ...input, _id: new Types.ObjectId(guideId), fileName: 'old.pdf', updatedAt: new Date() };
  t.mock.method(KnowledgeBaseGuideModel, 'findById', () => ({ lean: () => ({ exec: async () => current }) }));
  t.mock.method(KnowledgeBaseGuideModel, 'findOneAndDelete', () => ({ lean: () => ({ exec: async () => { throw new Error('database failed'); } }) }));
  try {
    await assert.rejects(guidePublishingService.remove(guideId, { updatedAt: current.updatedAt.toISOString() }));
    assert.deepEqual(await fs.readdir(root), ['old.pdf']);
  } finally { reset(); await clean(root); }
});
