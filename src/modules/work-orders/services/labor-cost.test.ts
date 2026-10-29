import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validationResult } from 'express-validator';
import { WorkOrderModel } from '../models/workOrder.model';
import { HistoryWorkOrderModel } from '../models/history-work-order.model';
import { workOrderValidator, updateWorkOrderValidator } from '../validators/workOrder.validator';
import { orderService } from './order.service';
import { sanitizeWorkOrderPayload } from './workOrder.policy';

for (const [name, validators] of [['create', workOrderValidator], ['update/patch', updateWorkOrderValidator]] as const) {
  for (const value of [125.50, 0, '25.75', null, undefined, -1, 'invalid', Infinity, 'Infinity', '', true]) {
    test(`${name} validates optional labor cost ${String(value)}`, async () => {
      const req: any = { body: {
        title: 'Test work order', priority: 'Low', wo_location_id: '111111111111111111111111',
        labor_entries: [{ vendor_name: 'Vendor', hours: 2, labor_cost: value }]
      } };
      for (const validator of validators) await validator.run(req);
      const errors = validationResult(req).array();
      const valid = value == null || [125.50, 0, '25.75'].includes(value as any);
      assert.equal(errors.length === 0, valid, JSON.stringify(errors));
    });
  }
}

for (const Model of [WorkOrderModel, HistoryWorkOrderModel]) {
  test(`${Model.modelName} persists optional labor cost and validates invalid values`, async () => {
    for (const value of [125.50, 0, null, undefined]) {
      const doc = new Model({ labor_entries: [{ vendor_name: 'Vendor', hours: 2, labor_cost: value }] });
      const entry: any = doc.labor_entries[0];
      await entry.validate();
      assert.equal(doc.toObject().labor_entries[0].labor_cost, value);
    }
    for (const value of [-1, Infinity, NaN]) {
      const doc = new Model({ labor_entries: [{ vendor_name: 'Vendor', hours: 2, labor_cost: value }] });
      const entry: any = doc.labor_entries[0];
      await assert.rejects(() => entry.validate());
    }
  });
}

test('controller payload policy and service normalization preserve numeric and unspecified labor costs', () => {
  for (const mode of ['create', 'update'] as const) {
    const payload = sanitizeWorkOrderPayload({ labor_entries: [
      { vendor_name: 'Vendor', hours: 2, labor_cost: '125.50' },
      { vendor_name: 'Vendor', hours: 1, labor_cost: 0 },
      { vendor_name: 'Vendor', hours: 1 },
      { vendor_name: 'Vendor', hours: 1, labor_cost: '' }
    ] }, mode);
    const result = (orderService as any).normalizeTimingFields(payload);
    assert.deepEqual(result.labor_entries.map((entry: any) => entry.labor_cost), [125.50, 0, null, null]);
    assert.equal(result.actual_time, 5);
    const doc = new WorkOrderModel(result);
    const history = new HistoryWorkOrderModel(doc.toObject());
    assert.deepEqual(history.toObject().labor_entries.map((entry: any) => entry.labor_cost), [125.50, 0, null, null]);
  }
});