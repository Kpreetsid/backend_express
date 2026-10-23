import assert from 'node:assert/strict';
import test from 'node:test';
import { partsService } from './parts.service';
const part = { part_id: '111111111111111111111111', estimatedQuantity: 5 };
test('completion preserves an explicit zero instead of consuming planned material', () => {
  const [result] = partsService.normalizeWorkOrderParts([{ ...part, actualQuantity: 0 }], 'Completed');
  assert.equal(result.actualQuantity, 0); assert.equal(result.issuedQuantity, 0);
  assert.equal(result.reservedQuantity, 0); assert.equal(result.returnedQuantity, 5);
});
test('completion accepts a numeric zero string from legacy forms', () => {
  const [result] = partsService.normalizeWorkOrderParts([{ ...part, actualQuantity: '0' }], 'Completed');
  assert.equal(result.issuedQuantity, 0);
});
test('legacy completion without any actual quantity still uses the estimate', () => {
  for (const actualQuantity of [undefined, null, '']) {
    const [result] = partsService.normalizeWorkOrderParts([{ ...part, actualQuantity }], 'Completed');
    assert.equal(result.issuedQuantity, 5);
  }
});
test('partial actual usage preserves remaining material and original input', () => {
  const input = { ...part, actualQuantity: 2 };
  const [active] = partsService.normalizeWorkOrderParts([input], 'In-Progress');
  const [complete] = partsService.normalizeWorkOrderParts([input], 'Completed');
  assert.equal(active.issuedQuantity, 2); assert.equal(active.reservedQuantity, 3);
  assert.equal(complete.returnedQuantity, 3); assert.deepEqual(input, { ...part, actualQuantity: 2 });
});
