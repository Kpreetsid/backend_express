import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import uploadRoutes from './upload.routes';
import { uploadController } from '../controllers/upload.controller';

test('upload routes retain account feature checks, role actions and account logo uploads', async t => {
  let roleMenu: any = {};
  let role: any = {};
  let uploads = 0;
  t.mock.method(uploadController, 'uploadBaseImage', async (_req: express.Request, res: express.Response) => {
    uploads++;
    return res.status(200).json({ status: true });
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { user: { user_role: 'admin' }, roleMenu, role });
    next();
  });
  app.use(uploadRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const post = (route: string, body: any = {}) => fetch(`http://127.0.0.1:${address.port}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });

  const disabled = await post('/baseImage/work_request');
  assert.equal(disabled.status, 403);
  assert.equal((await disabled.json() as any).code, 'ACCOUNT_FEATURE_DISABLED');
  assert.equal((await post('/work_request')).status, 403);
  assert.equal((await post('/baseImage', { folderName: 'work_request' })).status, 403);
  assert.equal(uploads, 0);

  roleMenu = { asset: { view: true } };
  assert.equal((await post('/baseImage/assets')).status, 403);
  assert.equal(uploads, 0);
  role = { asset: { edit_asset: true } };
  assert.equal((await post('/baseImage/assets')).status, 200);
  assert.equal(uploads, 1);

  roleMenu = {};
  assert.equal((await post('/baseImage/logo')).status, 200);
  assert.equal(uploads, 2);
});
