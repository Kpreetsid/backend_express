import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { partsService } from './parts.service';
import { PartsModel } from '../models/part.model';
import { InventoryMovementModel } from '../models/inventoryMovement.model';

const partId = '111111111111111111111111';
const accountId = '222222222222222222222222';
const workOrderId = '333333333333333333333333';
const user: any = { _id: '444444444444444444444444', firstName: 'Test', lastName: 'Technician' };

afterEach(() => mock.restoreAll());

function persistedPart(quantity: number) {
  const record: any = {
    _id: partId,
    part_name: 'Bearing',
    quantity,
    min_quantity: 1,
    updatedBy: null,
    save: async () => record
  };
  return record;
}

test('reserving planned material decrements stock and writes a reserve movement in the supplied transaction', async () => {
  const part = persistedPart(10);
  let savedOptions: any;
  let movements: any[] = [];
  mock.method(part, 'save', async (options: any) => { savedOptions = options; return part; });
  mock.method(PartsModel, 'findById', () => ({ session: async () => part }) as any);
  mock.method(InventoryMovementModel, 'insertMany', async (docs: any[]) => { movements = docs; return docs as any; });

  await partsService.adjustInventoryByWorkOrder(
    [],
    [{ part_id: partId, estimatedQuantity: 5 }],
    user,
    'session-1',
    { account_id: accountId, work_order_id: workOrderId, work_order_no: 'WO-1', previous_status: 'Open', next_status: 'Open' }
  );

  assert.equal(part.quantity, 5);
  assert.equal(savedOptions.session, 'session-1');
  assert.equal(movements.length, 1);
  assert.equal(movements[0].movement_type, 'reserve');
  assert.equal(movements[0].quantity, 5);
});

test('completion issues actual material and returns unused reservation atomically', async () => {
  const part = persistedPart(5);
  let movements: any[] = [];
  mock.method(PartsModel, 'findById', () => ({ session: async () => part }) as any);
  mock.method(InventoryMovementModel, 'insertMany', async (docs: any[]) => { movements = docs; return docs as any; });

  await partsService.adjustInventoryByWorkOrder(
    [{ part_id: partId, estimatedQuantity: 5 }],
    [{ part_id: partId, estimatedQuantity: 5, actualQuantity: 2 }],
    user,
    'session-2',
    { account_id: accountId, work_order_id: workOrderId, work_order_no: 'WO-1', previous_status: 'Open', next_status: 'Completed' }
  );

  assert.equal(part.quantity, 8);
  assert.deepEqual(movements.map(m => [m.movement_type, m.quantity]), [['issue', 2], ['return', 3]]);
});
