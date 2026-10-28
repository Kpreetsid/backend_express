import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { inspectionService } from './inspection.service';
import { InspectionModel } from '../models/inspection.model';
import { orderService } from '../../work-orders/services/order.service';
const transactions = require('../../../common/utils/transaction.helper');

const inspectionId = '111111111111111111111111';
const accountId = '222222222222222222222222';
const locationId = '333333333333333333333333';
const assetId = '444444444444444444444444';
const userId = '555555555555555555555555';
const workOrderId = '666666666666666666666666';
const actor: any = { _id: userId, account_id: accountId, user_role: 'admin', firstName: 'Test', lastName: 'Inspector' };

afterEach(() => mock.restoreAll());

function inspection(overrides: Record<string, unknown> = {}): any {
  return {
    _id: inspectionId,
    account_id: accountId,
    title: 'Pump inspection',
    description: 'Monthly inspection',
    location_id: locationId,
    asset_id: assetId,
    corrective_actions: [],
    no_of_actions: 0,
    updatedBy: null,
    save: async () => undefined,
    ...overrides
  };
}

test('inspection finding creates a source-bound corrective work order in the same transaction', async () => {
  const record = inspection();
  let capturedPayload: any;
  let capturedSession: any;
  mock.method(transactions, 'withTransaction', async (callback: any) => callback('session-1'));
  mock.method(InspectionModel, 'findOne', () => ({ session: async () => record }) as any);
  mock.method(record, 'save', async ({ session }: any) => { capturedSession = session; return record; });
  mock.method(orderService, 'createWorkOrder', async (payload: any, _user: any, session: any) => {
    capturedPayload = payload;
    assert.equal(session, 'session-1');
    return { _id: workOrderId, order_no: 'WO-20260001', title: payload.title } as any;
  });

  const result = await (inspectionService as any).createCorrectiveWorkOrder(
    inspectionId,
    'bearing-temperature',
    { title: 'Replace bearing', priority: 'High', description: 'Temperature above limit' },
    actor
  );

  assert.equal(result.order_no, 'WO-20260001');
  assert.equal(String(capturedPayload.wo_location_id), locationId);
  assert.equal(String(capturedPayload.wo_asset_id), assetId);
  assert.equal(String(capturedPayload.source_inspection_id), inspectionId);
  assert.equal(capturedPayload.source_finding_key, 'bearing-temperature');
  assert.equal(capturedPayload.createdFrom, 'Inspection');
  assert.equal(capturedPayload.status, 'Open');
  assert.equal(capturedSession, 'session-1');
  assert.equal(record.corrective_actions.length, 1);
  assert.equal(record.corrective_actions[0].finding_key, 'bearing-temperature');
  assert.equal(String(record.corrective_actions[0].work_order_id), workOrderId);
  assert.equal(record.no_of_actions, 1);
});

test('duplicate corrective action for the same finding is rejected before work-order creation', async () => {
  const record = inspection({
    corrective_actions: [{ finding_key: 'bearing-temperature', work_order_id: workOrderId, order_no: 'WO-20260001' }],
    no_of_actions: 1
  });
  mock.method(transactions, 'withTransaction', async (callback: any) => callback('session-1'));
  mock.method(InspectionModel, 'findOne', () => ({ session: async () => record }) as any);
  const create = mock.method(orderService, 'createWorkOrder', async () => ({ _id: workOrderId }) as any);

  await assert.rejects(
    (inspectionService as any).createCorrectiveWorkOrder(
      inspectionId,
      'bearing-temperature',
      { title: 'Duplicate corrective work' },
      actor
    ),
    (error: any) => error?.status === 409
  );
  assert.equal(create.mock.callCount(), 0);
});
