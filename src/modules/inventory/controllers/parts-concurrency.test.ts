import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { partsController } from './parts.controller';
import { partsService } from '../services/parts.service';

afterEach(() => mock.restoreAll());
for (const version of [1, 2]) test(`part edits enforce If-Match version ${version} while retaining account scope`, async () => {
  const id = '111111111111111111111111';
  const account = '222222222222222222222222';
  let error: any;
  let writes = 0;
  mock.method(partsService, 'getAllParts', async (filter: any) => {
    assert.equal(filter.account_id, account);
    assert.equal(filter.visible, true);
    return [{ _id: id, account_id: account, sync_version: 2 }] as any;
  });
  mock.method(partsService, 'updatePartById', async (_id: string, _body: any, _user: any, accountId: any, expectedVersion?: number) => {
    assert.equal(accountId, account);
    assert.equal(expectedVersion, 2);
    writes++;
    return {} as any;
  });
  const req: any = { params: { id }, body: { part_name: 'Updated' }, user: { user_role: 'admin', account_id: account }, header: () => `"${version}"` };
  const res: any = { once: () => res, setHeader: () => res, status: () => res, json: () => res };
  await partsController.updatePart(req, res, value => { error = value; });
  assert.equal(error?.status, version === 1 ? 412 : undefined);
  assert.equal(writes, version === 1 ? 0 : 1);
});
