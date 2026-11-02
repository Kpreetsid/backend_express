import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { requestService } from './request.service';
import { WorkRequestModel } from '../models/workRequest.model';

afterEach(() => mock.restoreAll());
for (const status of ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected']) {
  test(`dedicated decisions retain account scope and handle current ${status} requests`, async () => {
    const id = '111111111111111111111111';
    const account = '222222222222222222222222';
    mock.method(WorkRequestModel, 'updateOne', async (filter: any) => {
      assert.equal(filter._id, id);
      assert.equal(filter.account_id, account);
      assert.equal(filter.visible, true);
      assert.ok(filter.$or.some((condition: any) => condition.converted_work_order_id === null));
      const eligible = typeof filter.status === 'string' ? filter.status === status : filter.status.$in.includes(status);
      return { matchedCount: eligible ? 1 : 0, modifiedCount: eligible ? 1 : 0 } as any;
    });
    const expected = ['Approved', 'Rejected'].includes(status) ? 0 : 1;
    assert.equal((await requestService.markApproved(id, account, id, 'Low')).matchedCount, expected);
    assert.equal((await requestService.markRejected(id, account, id, 'Reason')).matchedCount, expected);
  });
}
