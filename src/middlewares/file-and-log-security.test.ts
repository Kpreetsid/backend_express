import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const tenantA = '64a000000000000000000001';
const tenantB = '64b000000000000000000002';
const name = (tenant: string) => `20261019-120000123-assets-${tenant}-0123abcd.png`;

function loadStatic(authentication: (req: any, res: any, next: any) => void) {
  const filename = path.join(__dirname, 'authenticatedStatic.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} as any };
  const localRequire = (id: string) => {
    if (id === 'express') return { static: () => (_req: any, res: any) => { res.served = true; } };
    if (id === '../_config/auth') return { isAuthenticated: authentication };
    return id.startsWith('.') ? require(path.resolve(__dirname, id)) : require(id);
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, __dirname, console });
  return module.exports.authenticatedStatic;
}

function loadIsolatedModule(relativePath: string, overrides: Record<string, any>) {
  const filename = path.resolve(__dirname, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} as any };
  const localRequire = (id: string) => Object.prototype.hasOwnProperty.call(overrides, id)
    ? overrides[id] : id.startsWith('.') ? require(path.resolve(path.dirname(filename), id)) : require(id);
  vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, __dirname: path.dirname(filename), console, process, URL });
  return module.exports;
}

test('static files require matching authenticated tenant, including legacy mounts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmms-owned-files-'));
  try {
    fs.writeFileSync(path.join(root, name(tenantB)), 'synthetic-file');
    const middleware = loadStatic((req, _res, next) => { req.user = { account_id: tenantA }; next(); })(root);
    const response: any = {};
    let error: any;
    await middleware({ method: 'GET', path: `/${name(tenantB)}` }, response, (value: any) => { error = value; });
    assert.equal(response.served, undefined, 'foreign account file must not reach static sink');
    assert.equal(error?.status, 403);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('same-tenant GET and HEAD still use the existing static path', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmms-own-control-'));
  try {
    fs.writeFileSync(path.join(root, name(tenantA)), 'synthetic-file');
    const middleware = loadStatic((req, _res, next) => { req.user = { account_id: tenantA }; next(); })(root);
    for (const method of ['GET', 'HEAD']) {
      const response: any = {};
      await middleware({ method, path: `/${name(tenantA)}` }, response, (error: any) => { assert.ifError(error); });
      assert.equal(response.served, true);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('legacy files with unknown ownership fail closed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmms-legacy-files-'));
  try {
    fs.writeFileSync(path.join(root, 'legacy-report.pdf'), 'synthetic-file');
    const middleware = loadStatic((req, _res, next) => { req.user = { account_id: tenantA }; next(); })(root);
    const response: any = {};
    let error: any;
    await middleware({ method: 'GET', path: '/legacy-report.pdf' }, response, (value: any) => { error = value; });
    assert.equal(response.served, undefined);
    assert.equal(error?.status, 403);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a tenant-named symlink cannot relabel a different tenant file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmms-link-files-'));
  try {
    fs.writeFileSync(path.join(root, name(tenantB)), 'synthetic-file');
    fs.symlinkSync(path.join(root, name(tenantB)), path.join(root, name(tenantA)));
    const middleware = loadStatic((req, _res, next) => { req.user = { account_id: tenantA }; next(); })(root);
    const response: any = {};
    let error: any;
    await middleware({ method: 'GET', path: `/${name(tenantA)}` }, response, (value: any) => { error = value; });
    assert.equal(response.served, undefined);
    assert.equal(error?.status, 403);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('URL logs remove path credentials and all query/fragment data', () => {
  const { sanitizeLogUrl } = require('../utils/log-redaction');
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.c3ludGhldGljLWxvY2FsLXRva2Vu.c3ludGhldGljLXNpZ25hdHVyZQ';
  for (const url of [`/cmms_express/api/users/${jwt}?account=private#secret`, `/api/users/${encodeURIComponent(jwt)}`,
    '/api/users/create_external_token/synthetic%40example.test', 'https://user:secret@example.test/login?external_token=synthetic#private']) {
    const result = sanitizeLogUrl(url);
    assert.ok(!result.includes(jwt));
    assert.ok(!result.includes('synthetic%40') && !result.includes('synthetic@example'));
    assert.ok(!result.includes('?') && !result.includes('#') && !result.includes('user:secret'));
  }
  assert.equal(sanitizeLogUrl('/api/work/orders?offset=5'), '/api/work/orders');
  assert.equal(sanitizeLogUrl('/api/master/users/64a000000000000000000001'), '/api/master/users/64a000000000000000000001');
});

test('nested log metadata redacts credentials and URL fields without changing safe values', () => {
  const { redactLogData } = require('../utils/log-redaction');
  const input = { action: 'read', nested: [{ password: 'synthetic-secret', api_key: 'synthetic-api-key', count: 4,
    pageUrl: '/login?token=synthetic-credential', referrer: '/login#secret' }] };
  const output = redactLogData(input);
  assert.equal(output.action, 'read');
  assert.equal(output.nested[0].password, '[REDACTED]');
  assert.equal(output.nested[0].api_key, '[REDACTED]');
  assert.equal(output.nested[0].count, 4);
  assert.equal(output.nested[0].pageUrl, '/login');
  assert.equal(output.nested[0].referrer, '/login');
  assert.equal(input.nested[0].password, 'synthetic-secret', 'redaction must not mutate live request input');
});

test('upload ownership is exact and never uses an arbitrary account substring', () => {
  const { getUploadAccountId, isUploadOwnedBy } = require('../utils/upload-ownership');
  assert.equal(getUploadAccountId(name(tenantA)), tenantA);
  assert.equal(isUploadOwnedBy(`/assets/${name(tenantA)}`, tenantA), true);
  assert.equal(isUploadOwnedBy(`/assets/${name(tenantB)}`, tenantA), false);
  assert.equal(isUploadOwnedBy(`legacy-${tenantA}.png`, tenantA), false);
  assert.equal(isUploadOwnedBy(`20261019-120000123-${tenantA}-0123abcd.pdf`, tenantA), true);
  assert.equal(isUploadOwnedBy(name(tenantA), ''), false);
});

test('request logging wires redaction into console, file, and persisted activity sinks', async () => {
  const formats: string[] = [];
  const tokens: Record<string, (req: any) => string> = {};
  const persisted: any[] = [];
  const morgan: any = (format: string) => { formats.push(format); return (_req: any, _res: any, next: any) => next(); };
  morgan.token = (key: string, callback: (req: any) => string) => { tokens[key] = callback; };
  const { logger } = loadIsolatedModule('logger.ts', {
    fs: { existsSync: () => true, createWriteStream: () => ({ end() {} }) },
    morgan,
    '../models/userLogs.model': { UserLogModel: class { constructor(value: any) { Object.assign(this, value); } } },
    '../_cache/streams/userLogProducer': { UserLogProducer: { pushLog: async (value: any) => { persisted.push(value); } } }
  });
  const credential = 'eyJhbGciOiJIUzI1NiJ9.c3ludGhldGljLWxvY2FsLXRva2Vu.c3ludGhldGljLXNpZ25hdHVyZQ';
  const req: any = {
    method: 'GET', originalUrl: `/cmms_express/api/users/${credential}?token=synthetic-query-secret`,
    user: { _id: '64a000000000000000000009', account_id: tenantA, username: 'Synthetic User' },
    headers: { accountid: tenantB, origin: 'https://app.example.test', page_url: '/login?external_token=synthetic-page-secret',
      referer: 'https://app.example.test/login?token=synthetic-referer-secret' },
    params: { token: credential }, body: { password: 'synthetic-body-secret', title: 'Safe title' },
    query: { api_key: 'synthetic-query-secret' }, socket: {}, hostname: 'api.example.test', protocol: 'https'
  };
  let finish: (() => Promise<void>) | undefined;
  const res: any = { statusCode: 200, locals: {}, on: (event: string, callback: () => Promise<void>) => { if (event === 'finish') finish = callback; } };
  let advanced = false;
  logger.logMiddleware()(req, res, () => { advanced = true; });
  assert.equal(advanced, true);
  assert.ok(finish);
  await finish!();
  assert.equal(formats.length, 2);
  for (const format of formats) {
    assert.ok(format.includes(':safe_url'));
    assert.ok(!/(?:^|\s):url(?:\s|$)/.test(format));
  }
  assert.equal(tokens.safe_url(req), '/cmms_express/api/users/[REDACTED]');
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].account_id, tenantA, 'a client header must not assign log ownership');
  assert.equal(persisted[0].requestUrl, '/cmms_express/api/users/[REDACTED]');
  assert.equal(persisted[0].pageUrl, 'https://app.example.test/login');
  assert.equal(persisted[0].networkInfo.referer, 'https://app.example.test/login');
  assert.equal(persisted[0].additionalData.body.title, 'Safe title');
  const serialized = JSON.stringify(persisted[0]);
  for (const secret of [credential, 'synthetic-query-secret', 'synthetic-page-secret', 'synthetic-referer-secret', 'synthetic-body-secret']) {
    assert.ok(!serialized.includes(secret), 'persisted log must exclude synthetic credentials');
  }
});

test('upload responses retain public URLs while omitting server filesystem paths', async () => {
  const { uploadService } = loadIsolatedModule('../upload/upload.service.ts', {
    '../models/upload.model': { UploadModel: class { constructor(value: any) { Object.assign(this, value); } } },
    '../_config/storage': { storageProvider: { getURL: (filename: string, folder: string) => `/api/${folder}/${filename}` } },
    './upload.multer': { uploadFilesService: {} }
  });
  let response: any;
  const req: any = { params: { folderName: 'assets' }, files: [{ filename: name(tenantA), originalname: 'asset.png', mimetype: 'image/png',
    destination: '/private/server/uploadFiles/assets', path: `/private/server/uploadFiles/assets/${name(tenantA)}`, size: 128 }] };
  const res: any = { status: () => res, send: (value: any) => { response = value; } };
  await uploadService.uploadService(req, res, (error: any) => assert.ifError(error));
  assert.equal(response.status, true);
  assert.equal(response.data[0].fileURL, `/api/assets/${name(tenantA)}`);
  assert.equal(response.data[0].fileName, name(tenantA));
  assert.equal(response.data[0].originalName, 'asset.png');
  assert.equal(response.data[0].filePath, undefined);
  assert.equal(response.data[0].destination, undefined);
  assert.ok(!JSON.stringify(response).includes('/private/server'));
});
