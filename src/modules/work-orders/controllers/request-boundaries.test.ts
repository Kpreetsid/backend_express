import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { requestController } from './request.controller';
import { requestService } from '@modules/work-orders/services/request.service';
import { notificationService } from '@modules/communications/services/notification-sender.service';
import { controllerCache } from '@core/cache/controller-cache.service';
const id = '111111111111111111111111', account = '222222222222222222222222';
const actor = { _id: '333333333333333333333333', account_id: account, user_role: 'admin', firstName: 'Test', lastName: 'Planner' };
const record = { _id: id, account_id: account, status: 'Open', remarks: 'Existing note', priority: 'Low', sync_version: 2 };
afterEach(() => mock.restoreAll());
function setup(body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
  let error: any, saved: any, search: any;
  const res: any = { statusCode: 200, once: () => res, setHeader: () => res, status: (code: number) => { res.statusCode = code; return res; }, json: () => res, send: () => res };
  const req: any = { params: { id }, user: actor, body, query, header: () => undefined, originalUrl: `/api/work/requests/${id}` };
  mock.method(requestService, 'getAllRequests', async (filter: any) => { search = filter; return [record] as any; });
  mock.method(requestService, 'updateRequest', async (_id: string, payload: any) => { saved = { ...payload }; return { matchedCount: 1, modifiedCount: 1 } as any; });
  mock.method(requestService, 'getRequestById', async () => record as any);
  mock.method(notificationService, 'notifyAccountUsers', async () => undefined as any);
  mock.method(controllerCache as any, 'getCachedPayload', async () => ({ hit: false, bypass: true, cacheKey: 'test' }));
  mock.method(controllerCache as any, 'set', async () => undefined);
  return { req, res, next: (value?: any) => { error = value; }, state: () => ({ error, saved, search }) };
}
test('priority-only update does not append undefined to existing remarks', async () => {
  const ctx = setup({ priority: 'High' }); await requestController.update(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.state().error, undefined); assert.equal(Object.prototype.hasOwnProperty.call(ctx.state().saved, 'remarks'), false);
});
for (const status of ['Approved', 'Rejected']) test(`generic update cannot bypass dedicated ${status} action`, async () => {
  const ctx = setup({ status }); await requestController.update(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.state().error?.status, 400); assert.equal(ctx.state().saved, undefined);
});
test('generic update cannot overwrite ownership or approval provenance', async () => {
  const ctx = setup({ priority: 'High', account_id: '444444444444444444444444', createdBy: id, approvedBy: id, converted_work_order_id: id, sync_version: 99 });
  await requestController.update(ctx.req, ctx.res, ctx.next); assert.equal(ctx.state().error, undefined);
  for (const key of ['account_id', 'createdBy', 'approvedBy', 'converted_work_order_id', 'sync_version']) assert.equal(Object.prototype.hasOwnProperty.call(ctx.state().saved, key), false, key);
});
test('detail query cannot replace request identity or mapping scope', async () => {
  const ctx = setup({}, { _id: '444444444444444444444444', location_id: '555555555555555555555555', account_id: '666666666666666666666666' });
  await requestController.getById(ctx.req, ctx.res, ctx.next); assert.equal(ctx.state().error, undefined);
  assert.equal(String(ctx.state().search._id), id); assert.equal(String(ctx.state().search.account_id), account); assert.equal(ctx.state().search.location_id, undefined);
});
test('rejection requires a nonblank reason', async () => {
  const ctx = setup({ remarks: '   ' });
  mock.method(requestService, 'markRejected', async () => { throw new Error('Decision should not be persisted'); });
  await requestController.reject(ctx.req, ctx.res, ctx.next); assert.equal(ctx.state().error?.status, 400);
});
