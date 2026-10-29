import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { enforceUploadPermission } from './upload-permission.middleware';

const run = async (req: any) => await new Promise<any>((resolve) => {
  const state: any = { statusCode: 200, body: null, nextCalled: false };
  const res: any = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: any) {
      state.body = body;
      resolve(state);
      return this;
    }
  };
  enforceUploadPermission(req, res, () => {
    state.nextCalled = true;
    resolve(state);
  });
});

test('missing upload context fails closed before storage middleware runs', async () => {
  const result = await run({ params: {}, body: {}, roleMenu: {}, role: {} });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.equal(result.body?.code, 'UPLOAD_CONTEXT_REQUIRED');
});

test('profile image remains available to any authenticated user', async () => {
  const result = await run({ params: { folderName: 'user_profile_img' }, body: {}, roleMenu: {}, role: {} });
  assert.equal(result.nextCalled, true);
});

test('enabled account feature does not bypass the user action permission', async () => {
  const result = await run({
    params: { folderName: 'assets' },
    body: {},
    roleMenu: { asset: { view: true } },
    role: { asset: { add_asset: false, edit_asset: false } }
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.body?.code, 'USER_PERMISSION_DENIED');
});

test('asset upload accepts either add or edit asset authority when the account feature is enabled', async () => {
  const result = await run({
    params: { folderName: 'assets' },
    body: {},
    roleMenu: { asset: { view: true } },
    role: { asset: { add_asset: true, edit_asset: false } }
  });
  assert.equal(result.nextCalled, true);
});

test('company logo upload requires admin-panel edit authority', async () => {
  const denied = await run({
    params: { folderName: 'logo' },
    body: {},
    roleMenu: { master_admin_panel: { view: true } },
    role: { admin_panel: { edit: false } }
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body?.code, 'USER_PERMISSION_DENIED');

  const allowed = await run({
    params: { folderName: 'logo' },
    body: {},
    roleMenu: { master_admin_panel: { view: true } },
    role: { admin_panel: { edit: true } }
  });
  assert.equal(allowed.nextCalled, true);
});

test('unknown upload folders fail closed', async () => {
  const result = await run({
    params: { folderName: 'unregistered-folder' },
    body: {},
    roleMenu: {},
    role: {}
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.body?.code, 'UNKNOWN_UPLOAD_CONTEXT');
});

test('root multipart route runs authorization before multer writes files', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/modules/upload/routes/upload.routes.ts'),
    'utf8'
  );
  assert.match(
    source,
    /router\.post\('\/'\s*,\s*enforceUploadPermission\s*,\s*upload\.array/
  );
});
