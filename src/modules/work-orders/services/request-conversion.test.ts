import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { requestService } from './request.service';
import { WorkRequestModel } from '@modules/work-orders/models/workRequest.model';

const requestId = '111111111111111111111111';
const workOrderId = '222222222222222222222222';
const actorId = '333333333333333333333333';

afterEach(() => mock.restoreAll());

test('conversion atomically claims only an approved unconverted request', async () => {
  let filter: any;
  mock.method(WorkRequestModel, 'updateOne', async (value: any) => {
    filter = value;
    return { matchedCount: 1, modifiedCount: 1 } as any;
  });

  await requestService.markConverted(requestId, {
    workOrderId,
    orderNo: 'WO-20260001',
    convertedBy: actorId,
    priority: 'High'
  });

  assert.equal(filter._id, requestId);
  assert.equal(filter.status, 'Approved');
  assert.deepEqual(filter.$or, [
    { converted_work_order_id: null },
    { converted_work_order_id: { $exists: false } }
  ]);
});

test('a second conversion attempt fails so its enclosing transaction rolls back', async () => {
  mock.method(WorkRequestModel, 'updateOne', async () => ({ matchedCount: 0, modifiedCount: 0 }) as any);

  await assert.rejects(
    requestService.markConverted(requestId, {
      workOrderId,
      orderNo: 'WO-20260002',
      convertedBy: actorId
    }),
    (error: any) => error?.status === 409 && /already been converted/i.test(error.message)
  );
});
