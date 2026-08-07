import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.hoisted(() => ({ session: { id: 'parts-session' } }));

vi.mock('../../utils/transaction.helper', () => ({
  withTransaction: async (callback: (session: any) => Promise<any>) => callback(transaction.session)
}));

import { InventoryMovementModel } from '../../models/inventoryMovement.model';
import { CycleCountModel } from '../../models/cycleCount.model';
import { PartHistoryModel } from '../../models/partHistory.model';
import { PartsModel } from '../../models/part.model';
import { ProcedureModel } from '../../models/procedure.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { partsService } from './parts.service';

const objectId = (suffix: string) => new mongoose.Types.ObjectId(`607f1f77bcf86cd7994390${suffix}`);

const sessionQuery = (value: any) => ({ session: vi.fn().mockResolvedValue(value) });

describe('parts stock adjustment transaction boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fails closed for missing stock, invalid quantities, and missing notes', async () => {
    vi.spyOn(PartsModel, 'findOne').mockReturnValueOnce(sessionQuery(null) as any);
    await expect(partsService.updatePartStock(
      String(objectId('11')), { quantity: 1, note: 'count' }, {}, objectId('12')
    )).rejects.toMatchObject({ message: 'Part not found', status: 404 });

    const part = { _id: objectId('13'), quantity: 5, part_name: 'Seal' };
    vi.spyOn(PartsModel, 'findOne')
      .mockReturnValueOnce(sessionQuery(part) as any)
      .mockReturnValueOnce(sessionQuery(part) as any);
    await expect(partsService.updatePartStock(
      String(part._id), { quantity: 'not-a-number', note: 'count' }, {}, objectId('14')
    )).rejects.toMatchObject({ message: 'Please provide a valid stock quantity', status: 400 });
    await expect(partsService.updatePartStock(
      String(part._id), { quantity: 1 }, {}, objectId('14')
    )).rejects.toMatchObject({ message: 'Reason / note is required for stock adjustments', status: 400 });
  });

  it('updates tenant-owned part fields with optimistic versioning and audit history', async () => {
    const partId = objectId('31');
    const existing: any = {
      _id: partId,
      account_id: objectId('32'),
      part_name: 'Seal',
      part_number: 'P-1',
      quantity: 5,
      sync_version: 3,
      toObject: () => ({ part_name: 'Seal', part_number: 'P-1', quantity: 5, sync_version: 3 })
    };
    const updated: any = { ...existing, part_name: 'Seal Kit', quantity: 6 };
    vi.spyOn(PartsModel, 'findOne').mockReturnValue(sessionQuery(existing) as any);
    const update = vi.spyOn(PartsModel, 'findOneAndUpdate').mockResolvedValue(updated);
    const historySave = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);

    await expect(partsService.updatePartById(
      String(partId),
      { part_name: 'Seal Kit', part_number: 'P-1', quantity: 6, sync_version: 3 } as any,
      { _id: objectId('33'), username: 'planner' },
      existing.account_id,
      3
    )).resolves.toBe(updated);

    expect(update).toHaveBeenCalledWith(
      { _id: String(partId), account_id: existing.account_id, visible: true, sync_version: 3 },
      expect.objectContaining({ part_name: 'Seal Kit', updatedBy: expect.any(mongoose.Types.ObjectId) }),
      { returnDocument: 'after', session: transaction.session }
    );
    expect(update.mock.calls[0]?.[1]).not.toHaveProperty('sync_version');
    expect(historySave).toHaveBeenCalledOnce();
    expect(historySave.mock.instances[0]).toMatchObject({
      action_type: 'updated',
      metadata: { changed_fields: expect.arrayContaining(['Part Name', 'Quantity']) }
    });
  });

  it('returns null for a missing part and fails a stale optimistic update', async () => {
    const partId = objectId('34');
    const accountId = objectId('35');
    const findOne = vi.spyOn(PartsModel, 'findOne');
    findOne.mockReturnValueOnce(sessionQuery(null) as any);
    await expect(partsService.updatePartById(
      String(partId), { part_name: 'Missing' } as any, objectId('36'), accountId
    )).resolves.toBeNull();

    const existing: any = {
      _id: partId, sync_version: 2, quantity: 1, part_name: 'Seal',
      toObject: () => ({ sync_version: 2, quantity: 1, part_name: 'Seal' })
    };
    findOne.mockReturnValueOnce(sessionQuery(existing) as any);
    vi.spyOn(PartsModel, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(PartsModel, 'findById').mockReturnValue(sessionQuery({ sync_version: 3 }) as any);
    await expect(partsService.updatePartById(
      String(partId), { part_name: 'Seal Kit' } as any, objectId('37'), accountId, 2
    )).rejects.toMatchObject({ name: 'PreconditionFailedError', status: 412 });
  });

  it.each([
    ['add', 2, 7, 'stock-added'],
    ['remove', 2, 3, 'stock-removed'],
    ['set', 2, 2, 'stock-set']
  ])('persists one %s adjustment, movement, and history record', async (mode, quantity, expected, action) => {
    const part: any = {
      _id: objectId('15'),
      quantity: 5,
      part_name: 'Bearing',
      location_id: objectId('16'),
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findOne').mockReturnValue(sessionQuery(part) as any);
    const movementSave = vi.spyOn(InventoryMovementModel.prototype, 'save').mockResolvedValue({} as any);
    const historySave = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);

    await expect(partsService.updatePartStock(
      String(part._id), { mode, quantity, note: 'Cycle count adjustment' },
      { _id: objectId('17'), username: 'operator' }, objectId('18')
    )).resolves.toBe(part);

    expect(part.quantity).toBe(expected);
    expect(part.save).toHaveBeenCalledWith({ session: transaction.session });
    expect(movementSave).toHaveBeenCalledOnce();
    expect(historySave).toHaveBeenCalledOnce();
    const historyDocument = historySave.mock.instances[0] as any;
    expect(historyDocument.action_type).toBe(action);
    expect(historyDocument.stock_before).toBe(5);
    expect(historyDocument.stock_after).toBe(expected);
  });

  it('does not write movement/history when set mode leaves stock unchanged', async () => {
    const part: any = {
      _id: objectId('19'), quantity: 5, part_name: 'Bearing',
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findOne').mockReturnValue(sessionQuery(part) as any);
    const movementSave = vi.spyOn(InventoryMovementModel.prototype, 'save').mockResolvedValue({} as any);
    const historySave = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);

    await partsService.updatePartStock(
      String(part._id), { mode: 'set', quantity: 5, note: 'verified' },
      objectId('20'), objectId('21')
    );
    expect(part.save).toHaveBeenCalledOnce();
    expect(movementSave).not.toHaveBeenCalled();
    expect(historySave).not.toHaveBeenCalled();
  });

  it('validates transfer invariants before modifying either stock record', async () => {
    const part: any = { _id: objectId('22'), quantity: 5, part_name: 'Seal', part_number: 'P-1' };
    const destinationId = objectId('23');
    const findOne = vi.spyOn(PartsModel, 'findOne');

    findOne.mockReturnValueOnce(sessionQuery(part) as any);
    await expect(partsService.updatePartStock(
      String(part._id), { mode: 'transfer', quantity: 1, note: 'move' }, {}, objectId('24')
    )).rejects.toMatchObject({ message: 'Please select a destination location for the transfer', status: 400 });

    findOne.mockReturnValueOnce(sessionQuery(part) as any);
    await expect(partsService.updatePartStock(
      String(part._id), { mode: 'transfer', destination_part_id: part._id, quantity: 1, note: 'move' }, {}, objectId('24')
    )).rejects.toMatchObject({ message: 'Source and destination locations must be different', status: 400 });

    findOne.mockReturnValueOnce(sessionQuery(part) as any);
    await expect(partsService.updatePartStock(
      String(part._id), { mode: 'transfer', destination_part_id: destinationId, quantity: 6, note: 'move' }, {}, objectId('24')
    )).rejects.toMatchObject({ message: 'Cannot transfer 6. Only 5 in stock.', status: 400 });

    findOne
      .mockReturnValueOnce(sessionQuery(part) as any)
      .mockReturnValueOnce(sessionQuery({ _id: destinationId, part_number: 'P-2' }) as any);
    await expect(partsService.updatePartStock(
      String(part._id), { mode: 'transfer', destination_part_id: destinationId, quantity: 1, note: 'move' }, {}, objectId('24')
    )).rejects.toMatchObject({ message: 'Destination location must belong to the same part number', status: 400 });
  });

  it('transfers stock atomically and records both sides', async () => {
    const source: any = {
      _id: objectId('25'), quantity: 8, part_name: 'Seal @ A', part_number: 'P-1',
      location_id: objectId('26'), save: vi.fn().mockResolvedValue(undefined)
    };
    const destination: any = {
      _id: objectId('27'), quantity: 2, part_name: 'Seal @ B', part_number: 'P-1',
      location_id: objectId('28'), save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findOne')
      .mockReturnValueOnce(sessionQuery(source) as any)
      .mockReturnValueOnce(sessionQuery(destination) as any);
    const movementSave = vi.spyOn(InventoryMovementModel.prototype, 'save').mockResolvedValue({} as any);
    const historySave = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);

    await expect(partsService.updatePartStock(
      String(source._id),
      { mode: 'transfer', destination_part_id: destination._id, quantity: 3, note: 'balance stores' },
      { _id: objectId('29'), firstName: 'Inventory', lastName: 'Manager' },
      objectId('30')
    )).resolves.toBe(source);

    expect(source.quantity).toBe(5);
    expect(destination.quantity).toBe(5);
    expect(source.save).toHaveBeenCalledWith({ session: transaction.session });
    expect(destination.save).toHaveBeenCalledWith({ session: transaction.session });
    expect(movementSave).toHaveBeenCalledTimes(2);
    expect(historySave).toHaveBeenCalledTimes(2);
  });

  it('adjusts reserved work-order stock once and returns low-stock warnings', async () => {
    const partId = objectId('38');
    const part: any = {
      _id: partId, part_name: 'Seal', quantity: 5, min_quantity: 2,
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findById').mockReturnValue(sessionQuery(part) as any);
    const insertMany = vi.spyOn(InventoryMovementModel, 'insertMany').mockResolvedValue([] as any);

    await expect(partsService.adjustInventoryByWorkOrder(
      [],
      [{ part_id: partId, estimatedQuantity: 3 }],
      { _id: objectId('39'), username: 'planner' },
      transaction.session,
      { account_id: objectId('40'), work_order_id: objectId('41'), work_order_no: 'WO-1', next_status: 'Open' }
    )).resolves.toEqual({
      warnings: [{ part_id: partId, part_name: 'Seal', quantity: 2, min_quantity: 2 }]
    });

    expect(part.quantity).toBe(2);
    expect(part.save).toHaveBeenCalledWith({ session: transaction.session });
    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ movement_type: 'reserve', quantity: 3, stock_before: 5, stock_after: 2 })
    ], { session: transaction.session });
  });

  it('records issue and return movements when completing a partially used reservation', async () => {
    const partId = objectId('42');
    const part: any = {
      _id: partId, part_name: 'Bearing', quantity: 5, min_quantity: 1,
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findById').mockReturnValue(sessionQuery(part) as any);
    const insertMany = vi.spyOn(InventoryMovementModel, 'insertMany').mockResolvedValue([] as any);

    await partsService.adjustInventoryByWorkOrder(
      [{ part_id: partId, estimatedQuantity: 5 }],
      [{ part_id: partId, estimatedQuantity: 5, actualQuantity: 2 }],
      { _id: objectId('43'), firstName: 'Technician' },
      transaction.session,
      { account_id: objectId('44'), previous_status: 'Open', next_status: 'Completed' }
    );

    expect(part.quantity).toBe(8);
    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ movement_type: 'issue', quantity: 2 }),
      expect.objectContaining({ movement_type: 'return', quantity: 3 })
    ], { session: transaction.session });
  });

  it('creates cycle counts with discrepancy state and returns the enriched contract', async () => {
    const partId = objectId('45');
    const part = {
      _id: partId, part_name: 'Seal', part_number: 'P-1', barcode: 'B-1',
      location_id: objectId('46'), quantity: 10
    };
    vi.spyOn(PartsModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(part) } as any);
    vi.spyOn(CycleCountModel.prototype, 'save').mockImplementation(async function (this: any) { return this; });
    vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);
    const enrich = vi.spyOn(partsService, 'getCycleCounts').mockResolvedValue([{ id: 'enriched-count' }]);

    await expect(partsService.createCycleCount(
      { part_id: String(partId), counted_quantity: 8, reason: 'Shelf count' },
      objectId('47'), { _id: objectId('48'), username: 'counter' }
    )).resolves.toEqual({ id: 'enriched-count' });

    const count = (CycleCountModel.prototype.save as any).mock.instances[0] as any;
    expect(count).toMatchObject({
      system_quantity: 10,
      counted_quantity: 8,
      discrepancy_quantity: -2,
      discrepancy_percent: -20,
      status: 'pending-approval'
    });
    expect(enrich).toHaveBeenCalledWith({ _id: count._id, account_id: expect.any(mongoose.Types.ObjectId) });
  });

  it('lists cycle counts and rejects unknown part/count identifiers', async () => {
    vi.spyOn(CycleCountModel, 'aggregate').mockResolvedValue([{ id: 'count-1' }] as any);
    await expect(partsService.getCycleCounts({ account_id: objectId('52') }))
      .resolves.toEqual([{ id: 'count-1' }]);

    vi.spyOn(PartsModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);
    await expect(partsService.createCycleCount(
      { part_id: String(objectId('53')), counted_quantity: 1 }, objectId('54'), { _id: objectId('55') }
    )).rejects.toMatchObject({ message: 'Part not found', status: 404 });

    vi.spyOn(CycleCountModel, 'findOne').mockReturnValue(sessionQuery(null) as any);
    await expect(partsService.approveCycleCount(
      String(objectId('56')), 'approved', objectId('57'), { _id: objectId('58') }
    )).rejects.toMatchObject({ message: 'Cycle count not found', status: 404 });
  });

  it('rejects a cycle count without changing stock and preserves enriched output', async () => {
    const count: any = {
      _id: objectId('59'), part_id: objectId('60'), part_name: 'Seal', part_number: 'P-1',
      system_quantity: 5, counted_quantity: 3, discrepancy_quantity: -2,
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({ fallback: true })
    };
    vi.spyOn(CycleCountModel, 'findOne').mockReturnValue(sessionQuery(count) as any);
    const historySave = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);
    vi.spyOn(partsService, 'getCycleCounts').mockResolvedValue([{ id: 'reviewed' }]);

    await expect(partsService.approveCycleCount(
      String(count._id), 'rejected', objectId('61'),
      { _id: objectId('62'), firstName: 'Inventory', lastName: 'Lead' }, 'Count again'
    )).resolves.toEqual({ id: 'reviewed' });

    expect(count).toMatchObject({
      status: 'rejected', approval_notes: 'Count again', reviewedByName: 'Inventory Lead'
    });
    expect(historySave.mock.instances[0]).toMatchObject({
      action_type: 'cycle-count-rejected', stock_before: 5, stock_after: 5
    });
    expect(count.save).toHaveBeenCalledWith({ session: transaction.session });
  });

  it('approves a cycle count, adjusts stock, and records the counted movement', async () => {
    const count: any = {
      _id: objectId('63'), part_id: objectId('64'), part_name: 'Bearing', part_number: 'P-2',
      system_quantity: 8, counted_quantity: 5, discrepancy_quantity: -3, reason: 'Damaged stock',
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({ fallback: true })
    };
    const part: any = {
      _id: count.part_id, part_name: 'Bearing', quantity: 8, location_id: objectId('65'),
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(CycleCountModel, 'findOne').mockReturnValue(sessionQuery(count) as any);
    vi.spyOn(PartsModel, 'findOne').mockReturnValue(sessionQuery(part) as any);
    const movementSave = vi.spyOn(InventoryMovementModel.prototype, 'save').mockResolvedValue({} as any);
    const historySave = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);
    vi.spyOn(partsService, 'getCycleCounts').mockResolvedValue([]);

    await expect(partsService.approveCycleCount(
      String(count._id), 'approved', objectId('66'), { _id: objectId('67'), username: 'approver' }
    )).resolves.toEqual({ fallback: true });

    expect(part.quantity).toBe(5);
    expect(part.save).toHaveBeenCalledWith({ session: transaction.session });
    expect(movementSave.mock.instances[0]).toMatchObject({
      movement_type: 'count-adjustment', quantity: 3, stock_before: 8, stock_after: 5
    });
    expect(historySave.mock.instances[0]).toMatchObject({ action_type: 'cycle-count-approved' });
  });

  it('calculates and sorts replenishment suggestions from open demand and procedure usage', async () => {
    const criticalId = objectId('49');
    const highId = objectId('50');
    vi.spyOn(partsService, 'getAllParts').mockResolvedValue([
      {
        _id: highId, part_name: 'Bearing', part_number: 'P-2', quantity: 5,
        min_quantity: 4, reorder_point: 4, lead_time_days: 5
      },
      {
        _id: criticalId, part_name: 'Seal', part_number: 'P-1', quantity: 2,
        min_quantity: 2, reorder_point: 3, lead_time_days: 7,
        network_on_hand: 9, alternative_locations: [{ id: 'alternate' }]
      }
    ] as any);
    vi.spyOn(WorkOrderModel, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { parts: [{ part_id: criticalId, estimatedQuantity: 4 }] },
        { parts: [{ part_id: highId, reservedQuantity: 2 }] }
      ])
    } as any);
    vi.spyOn(ProcedureModel, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { name: 'Inspection', required_parts: [{ part_id: criticalId, quantity: 2 }] },
        { name: 'Inspection', required_parts: [{ part_id: criticalId, quantity: 1 }] }
      ])
    } as any);

    const suggestions = await partsService.getReplenishmentSuggestions(objectId('51'));
    expect(suggestions.map((item: any) => item.part_name)).toEqual(['Seal', 'Bearing']);
    expect(suggestions[0]).toMatchObject({
      open_demand: 4,
      projected_available: -2,
      recommended_order_qty: 8,
      urgency: 'critical',
      network_on_hand: 9,
      procedure_usage_count: 2,
      procedure_required_quantity: 3,
      procedure_names: ['Inspection']
    });
    expect(suggestions[1]).toMatchObject({
      open_demand: 2,
      projected_available: 3,
      recommended_order_qty: 5,
      urgency: 'high'
    });
  });
});
