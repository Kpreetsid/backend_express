import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';
import { Types } from 'mongoose';
import { KnowledgeBaseGuideModel } from './knowledge-base.model';
import { knowledgeBaseService, resolveGuidePdf } from './knowledge-base.service';
import { knowledgeBaseRoutes } from './knowledge-base.routes';

const id = '64a000000000000000000001';
const guide = { _id: new Types.ObjectId(id), title: 'Sensor Installation', description: 'Install a sensor.',
  category: 'sensor-installation', size: 30, fileName: 'sensor.pdf', published: true,
  createdAt: new Date(), updatedAt: new Date() };

async function temporaryFiles() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-base-test-'));
  return { root, async clean() {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith('knowledge-base-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  } };
}

test('guides are unpublished by default and only PDF file names are accepted', async () => {
  const document = new KnowledgeBaseGuideModel({ ...guide, published: undefined });
  await document.validate(); assert.equal(document.published, false);
  assert.equal(KnowledgeBaseGuideModel.schema.options.autoCreate, false);
  for (const fileName of ['../secret.pdf', 'folder/file.pdf', 'file.html', 'C:\\secret.pdf']) {
    await assert.rejects(new KnowledgeBaseGuideModel({ ...guide, fileName }).validate());
  }
});

test('catalog is shared across accounts and excludes unpublished guides and file paths', async t => {
  let filter: unknown;
  const query = { select: () => query, sort: () => query, lean: () => query, exec: async () => [guide] };
  t.mock.method(KnowledgeBaseGuideModel, 'find', (value: unknown) => { filter = value; return query; });
  const result = await knowledgeBaseService.listGuides();
  assert.deepEqual(filter, { published: true });
  assert.equal(result[0]?.id, id);
  assert.equal('fileName' in result[0]!, false);
  assert.equal('published' in result[0]!, false);
});

test('PDF lookup requires a valid ID and published metadata', async t => {
  let filter: unknown;
  const query = { lean: () => query, exec: async () => guide };
  t.mock.method(KnowledgeBaseGuideModel, 'findOne', (value: unknown) => { filter = value; return query; });
  assert.equal((await knowledgeBaseService.findPublishedGuide(id)).fileName, 'sensor.pdf');
  assert.deepEqual(filter, { _id: new Types.ObjectId(id), published: true });
  await assert.rejects(knowledgeBaseService.findPublishedGuide('../file'), { status: 404 });
});

test('unpublished or missing IDs cannot be downloaded', async t => {
  t.mock.method(KnowledgeBaseGuideModel, 'findOne', () => ({ lean: () => ({ exec: async () => null }) }));
  await assert.rejects(knowledgeBaseService.findPublishedGuide(id), { status: 404 });
});

test('file resolution checks PDF signatures and prevents traversal', async () => {
  const files = await temporaryFiles();
  try {
    await fs.writeFile(path.join(files.root, 'sensor.pdf'), '%PDF-1.4\nfixture\n%%EOF');
    await fs.writeFile(path.join(files.root, 'fake.pdf'), '<html>not a guide</html>');
    assert.equal(await resolveGuidePdf('sensor.pdf', files.root), await fs.realpath(path.join(files.root, 'sensor.pdf')));
    for (const fileName of ['../sensor.pdf', 'folder/sensor.pdf', 'fake.pdf', 'missing.pdf']) {
      await assert.rejects(resolveGuidePdf(fileName, files.root), { status: 404 });
    }
  } finally { await files.clean(); }
});

test('HTTP reads work for different authenticated users; writing is unavailable', async t => {
  const files = await temporaryFiles();
  const previousRoot = process.env.KNOWLEDGE_BASE_FILES_DIR;
  process.env.KNOWLEDGE_BASE_FILES_DIR = files.root;
  await fs.writeFile(path.join(files.root, 'sensor.pdf'), '%PDF-1.4\nfixture\n%%EOF');
  t.mock.method(knowledgeBaseService, 'listGuides', async () => [{
    id, title: guide.title, description: guide.description, category: guide.category,
    size: guide.size, updatedAt: guide.updatedAt
  }]);
  t.mock.method(knowledgeBaseService, 'findPublishedGuide', async (requested: string) => {
    if (requested !== id) { throw Object.assign(new Error('Unavailable'), { status: 404 }); }
    return guide;
  });
  const app = express();
  app.use('/api/knowledge-base', (req, res, next) => {
    if (!req.get('authorization')) { res.sendStatus(401); return; }
    next();
  }, knowledgeBaseRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ status: false });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/knowledge-base`;
  try {
    assert.equal((await fetch(`${url}/guides`)).status, 401);
    assert.equal((await fetch(`${url}/guides/${id}/file`)).status, 401);
    for (const user of ['reader-company-A', 'reader-company-B']) {
      const headers = { authorization: user };
      const response = await fetch(`${url}/guides`, { headers });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as any).data.guides[0].id, id);
      const pdf = await fetch(`${url}/guides/${id}/file`, { headers });
      assert.equal(pdf.headers.get('content-type'), 'application/pdf');
      assert.match(pdf.headers.get('content-disposition') || '', /^inline/);
      assert.match(await pdf.text(), /^%PDF-/);
      const download = await fetch(`${url}/guides/${id}/file?download=1`, { headers });
      assert.match(download.headers.get('content-disposition') || '', /^attachment/);
      assert.equal((await fetch(`${url}/guides/unpublished/file`, { headers })).status, 404);
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        assert.equal((await fetch(`${url}/guides`, { headers, method })).status, 404);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previousRoot === undefined) { delete process.env.KNOWLEDGE_BASE_FILES_DIR; }
    else { process.env.KNOWLEDGE_BASE_FILES_DIR = previousRoot; }
    await files.clean();
  }
});
