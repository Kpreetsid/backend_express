import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.hoisted(() => ({ session: { id: 'parts-branch-session' } }));

vi.mock('../../utils/transaction.helper', () => ({
  withTransaction: async (callback: (session: any) => Promise<any>) => callback(transaction.session)
}));

import { CycleCountModel } from '../../models/cycleCount.model';
import { InventoryMovementModel } from '../../models/inventoryMovement.model';
import { PartHistoryModel } from '../../models/partHistory.model';
import { PartsModel } from '../../models/part.model';
import { ProcedureModel } from '../../models/procedure.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { partsService } from './parts.service';

const service = partsService as any;
const objectId = (suffix: string) => new mongoose.Types.ObjectId(`707f1f77bcf86cd7994390${suffix}`);
const sessionQuery = (value: any) => ({ session: vi.fn().mockResolvedValue(value) });
const awaitableSessionQuery = (value: any) => {
  const query: any = {
    session: vi.fn(),
    then: (resolve: (result: any) => void) => Promise.resolve(resolve(value))
  };
  query.session.mockReturnValue(query);
  return query;
};

describe('parts branch and failure invariants', () => {
  afterEach(() => vi.restoreAllMocks());

  it('covers lifecycle defaults, invalid actuals, movement fallbacks, and empty normalization', () => {
    const partId = objectId('11');

    expect(partsService.normalizeWorkOrderParts(null as any, 'Open')).toEqual([]);
    expect(service.getPartIdValue({ id: partId })).toBe(String(partId));
    expect(service.getPartIdValue({ _id: partId })).toBe(String(partId));
    expect(service.getEstimatedQuantity({ estimatedQuantity: 'bad' })).toBe(0);
    expect(service.getIssuedQuantity({ estimatedQuantity: 4, actualQuantity: -1 }, 'Completed')).toBe(4);
    expect(service.getIssuedQuantity({ estimatedQuantity: 4, actualQuantity: '' }, 'Completed')).toBe(4);
    expect(service.getReservedImpact({ estimatedQuantity: 2, actualQuantity: 5 }, 'In-Progress')).toBe(0);

    expect(service.createMovementRecord('reserve', 0, 1, 1, {}, {}, {})).toBeNull();
    expect(service.createMovementRecord(
      'reserve', 2, Number.NaN, Number.NaN,
      { account_id: objectId('12'), location_id: objectId('13') },
      { username: 'operator' },
      { _id: partId, part_name: 'Seal' }
    )).toEqual(expect.objectContaining({
      work_order_id: null,
      work_order_no: '',
      location_id: objectId('13'),
      stock_before: undefined,
      stock_after: undefined,
      note: '',
      createdBy: undefined,
      createdByName: 'operator'
    }));

    expect(service.buildLifecyclePart({
      id: partId,
      estimatedQuantity: 0,
      part_source: 'invalid',
      procedureNames: 'not-an-array'
    }, 'Open')).toMatchObject({
      part_id: String(partId),
      part_type: 'N/A',
      location_id: null,
      location_name: null,
      part_source: 'manual',
      procedureNames: [],
      lifecycle_status: 'planned',
      actualQuantity: null
    });
  });

  it('omits invalid history values and no-ops when the part has no persisted id', async () => {
    const save = vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);

    await service.createPartHistoryEntry({ account_id: objectId('14'), part: {}, action_type: 'updated' });
    expect(save).not.toHaveBeenCalled();

    const partId = objectId('15');
    await service.createPartHistoryEntry({
      account_id: objectId('16'),
      part: { _id: partId, part_name: 'Bearing', part_number: 'P-1' },
      action_type: 'updated',
      user: { _id: objectId('17'), firstName: 'Inventory', lastName: 'Lead' },
      quantity: 'invalid',
      stock_before: undefined,
      stock_after: null,
      metadata: { location_name: 'Stores' }
    }, transaction.session);

    const history = save.mock.instances[0] as any;
    expect(history).toMatchObject({
      part_id: partId,
      location_name: 'Stores',
      note: '',
      metadata: { location_name: 'Stores' },
      actor_id: objectId('17'),
      actor_name: 'Inventory Lead'
    });
    expect(history.quantity).toBeUndefined();
    expect(save).toHaveBeenCalledWith({ session: transaction.session });
  });

  it('validates only negative inventory deltas with and without a transaction session', async () => {
    const partId = objectId('18');
    const findById = vi.spyOn(PartsModel, 'findById');

    await partsService.validateInventoryByWorkOrder(
      [{ part_id: partId, estimatedQuantity: 4 }],
      [{ part_id: partId, estimatedQuantity: 2 }]
    );
    expect(findById).not.toHaveBeenCalled();

    findById.mockResolvedValueOnce(null);
    await expect(partsService.validateInventoryByWorkOrder(
      [], [{ part_id: partId, estimatedQuantity: 2 }]
    )).resolves.toBeUndefined();

    const query = awaitableSessionQuery({ quantity: 2, part_name: 'Bearing' });
    findById.mockReturnValueOnce(query);
    await expect(partsService.validateInventoryByWorkOrder(
      [], [{ part_id: partId, estimatedQuantity: 3 }], 'Open', 'Open', transaction.session
    )).rejects.toMatchObject({ message: 'Insufficient stock for Bearing', status: 400 });
    expect(query.session).toHaveBeenCalledWith(transaction.session);

    findById.mockResolvedValueOnce({ quantity: 3, part_name: 'Bearing' } as any);
    await expect(partsService.validateInventoryByWorkOrder(
      [], [{ part_id: partId, estimatedQuantity: 3 }]
    )).resolves.toBeUndefined();
  });

  it('covers stock adjustment quantity and destination failure branches', async () => {
    const source: any = {
      _id: objectId('19'), quantity: 5, part_name: 'Seal', part_number: 'P-1',
      save: vi.fn().mockResolvedValue(undefined)
    };
    const destinationId = objectId('20');
    const findOne = vi.spyOn(PartsModel, 'findOne');

    findOne.mockReturnValueOnce(sessionQuery(source) as any);
    await expect(partsService.updatePartStock(
      String(source._id), { mode: 'set', quantity: -1, note: 'invalid' }, {}, objectId('21')
    )).rejects.toMatchObject({ message: 'Stock quantity cannot be negative', status: 400 });

    for (const mode of ['add', 'remove', 'transfer']) {
      findOne.mockReturnValueOnce(sessionQuery(source) as any);
      await expect(partsService.updatePartStock(
        String(source._id), {
          mode,
          destination_part_id: mode === 'transfer' ? destinationId : undefined,
          quantity: 0,
          note: 'invalid'
        }, {}, objectId('21')
      )).rejects.toMatchObject({ message: 'Please enter a quantity greater than zero', status: 400 });
    }

    findOne
      .mockReturnValueOnce(sessionQuery(source) as any)
      .mockReturnValueOnce(sessionQuery(null) as any);
    await expect(partsService.updatePartStock(
      String(source._id), {
        mode: 'transfer', destination_part_id: destinationId, quantity: 1, note: 'move'
      }, {}, objectId('21')
    )).rejects.toMatchObject({ message: 'Destination part record not found', status: 404 });

    findOne.mockReturnValueOnce(sessionQuery(source) as any);
    await expect(partsService.updatePartStock(
      String(source._id), { mode: 'remove', quantity: 6, note: 'remove' }, {}, objectId('21')
    )).rejects.toMatchObject({ message: 'Cannot remove 6. Only 5 in stock.', status: 400 });
  });

  it('reverts increased, reduced, unchanged, missing, and insufficient legacy allocations', async () => {
    const restored: any = {
      _id: objectId('22'), quantity: 2, part_name: 'Seal', save: vi.fn().mockResolvedValue(undefined)
    };
    const reduced: any = {
      _id: objectId('23'), quantity: 5, part_name: 'Bearing', save: vi.fn().mockResolvedValue(undefined)
    };
    const findById = vi.spyOn(PartsModel, 'findById')
      .mockResolvedValueOnce(restored)
      .mockResolvedValueOnce(reduced)
      .mockResolvedValueOnce(null);

    await partsService.revertPartFromWorkOrder(
      [
        { part_id: restored._id, estimatedQuantity: 4 },
        { part_id: reduced._id, estimatedQuantity: 1 },
        { part_id: objectId('24'), estimatedQuantity: 2 },
        { part_id: objectId('25'), estimatedQuantity: 1 }
      ],
      [
        { part_id: restored._id, estimatedQuantity: 1 },
        { part_id: reduced._id, estimatedQuantity: 3 },
        { part_id: objectId('24'), estimatedQuantity: 2 },
        { part_id: objectId('25'), estimatedQuantity: 0 }
      ],
      { _id: objectId('26') }
    );

    expect(restored.quantity).toBe(5);
    expect(reduced.quantity).toBe(3);
    expect(restored.save).toHaveBeenCalled();
    expect(reduced.save).toHaveBeenCalled();
    expect(findById).toHaveBeenCalledTimes(3);

    const newDemand: any = { quantity: 0, part_name: 'Filter' };
    vi.spyOn(PartsModel, 'findById').mockResolvedValueOnce(newDemand);
    await expect(partsService.revertPartFromWorkOrder(
      [], [{ part_id: objectId('27'), estimatedQuantity: 1 }], { _id: objectId('28') }
    )).rejects.toMatchObject({ message: 'Not enough quantity for Filter', status: 400 });

    const increasedDemand: any = { quantity: 1, part_name: 'Filter' };
    vi.spyOn(PartsModel, 'findById').mockResolvedValueOnce(increasedDemand);
    await expect(partsService.revertPartFromWorkOrder(
      [{ part_id: objectId('29'), estimatedQuantity: 1 }],
      [{ part_id: objectId('29'), estimatedQuantity: 3 }],
      { _id: objectId('30') }
    )).rejects.toMatchObject({ message: 'Insufficient inventory for Filter', status: 400 });
  });

  it('records reserve and return changes during an in-progress quantity correction', async () => {
    const partId = objectId('31');
    const part: any = {
      _id: partId, part_name: 'Bearing', quantity: 10, min_quantity: 1,
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findById').mockReturnValue(sessionQuery(part) as any);
    const insertMany = vi.spyOn(InventoryMovementModel, 'insertMany').mockResolvedValue([] as any);

    await partsService.adjustInventoryByWorkOrder(
      [{ part_id: partId, estimatedQuantity: 5, actualQuantity: 3 }],
      [{ part_id: partId, estimatedQuantity: 5, actualQuantity: 1 }],
      { _id: objectId('32') },
      transaction.session,
      { account_id: objectId('33'), previous_status: 'In-Progress', next_status: 'In-Progress' }
    );

    expect(part.quantity).toBe(10);
    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ movement_type: 'reserve', quantity: 2 }),
      expect.objectContaining({ movement_type: 'return', quantity: 2 })
    ], { session: transaction.session });
  });

  it('records completed corrections and both directions of work-order reopening', async () => {
    const completedId = objectId('34');
    const reopenReserveId = objectId('35');
    const reopenReleaseId = objectId('36');
    const parts: any[] = [
      { _id: completedId, part_name: 'A', quantity: 10, min_quantity: 0, save: vi.fn() },
      { _id: reopenReserveId, part_name: 'B', quantity: 10, min_quantity: 0, save: vi.fn() },
      { _id: reopenReleaseId, part_name: 'C', quantity: 10, min_quantity: 0, save: vi.fn() }
    ];
    parts.forEach((part) => part.save.mockResolvedValue(undefined));
    vi.spyOn(PartsModel, 'findById')
      .mockReturnValueOnce(sessionQuery(parts[0]) as any)
      .mockReturnValueOnce(sessionQuery(parts[1]) as any)
      .mockReturnValueOnce(sessionQuery(parts[2]) as any);
    const insertMany = vi.spyOn(InventoryMovementModel, 'insertMany').mockResolvedValue([] as any);
    const context = { account_id: objectId('37') };

    await partsService.adjustInventoryByWorkOrder(
      [{ part_id: completedId, estimatedQuantity: 5, actualQuantity: 5 }],
      [{ part_id: completedId, estimatedQuantity: 5, actualQuantity: 3 }],
      { _id: objectId('38') }, transaction.session,
      { ...context, previous_status: 'Completed', next_status: 'Completed' }
    );
    await partsService.adjustInventoryByWorkOrder(
      [{ part_id: reopenReserveId, estimatedQuantity: 5, actualQuantity: 2 }],
      [{ part_id: reopenReserveId, estimatedQuantity: 5 }],
      { _id: objectId('38') }, transaction.session,
      { ...context, previous_status: 'Completed', next_status: 'Open' }
    );
    await partsService.adjustInventoryByWorkOrder(
      [{ part_id: reopenReleaseId, estimatedQuantity: 5, actualQuantity: 5 }],
      [{ part_id: reopenReleaseId, estimatedQuantity: 2 }],
      { _id: objectId('38') }, transaction.session,
      { ...context, previous_status: 'Completed', next_status: 'Open' }
    );

    expect(insertMany.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ movement_type: 'return', quantity: 2 })
    ]);
    expect(insertMany.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ movement_type: 'reserve', quantity: 3 })
    ]);
    expect(insertMany.mock.calls[2]?.[0]).toEqual([
      expect.objectContaining({ movement_type: 'release', quantity: 3 })
    ]);
  });

  it('skips missing adjustments, fails insufficient stock, and can run through its own transaction', async () => {
    const missingId = objectId('39');
    const insufficientId = objectId('40');
    const validId = objectId('41');
    const valid: any = {
      _id: validId, part_name: 'Valid', quantity: 5, min_quantity: 0,
      save: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(PartsModel, 'findById')
      .mockReturnValueOnce(sessionQuery(null) as any)
      .mockReturnValueOnce(sessionQuery({ _id: insufficientId, part_name: 'Rare', quantity: 1 }) as any)
      .mockReturnValueOnce(sessionQuery(valid) as any);

    await expect(partsService.adjustInventoryByWorkOrder(
      [], [{ part_id: missingId, estimatedQuantity: 1 }], {}, transaction.session
    )).resolves.toEqual({ warnings: [] });
    await expect(partsService.adjustInventoryByWorkOrder(
      [], [{ part_id: insufficientId, estimatedQuantity: 2 }], {}, transaction.session
    )).rejects.toMatchObject({ message: 'Insufficient stock for Rare', status: 400 });
    await expect(partsService.adjustInventoryByWorkOrder(
      [], [{ part_id: validId, estimatedQuantity: 1 }], { _id: objectId('42') }
    )).resolves.toEqual({ warnings: [] });
    expect(valid.save).toHaveBeenCalledWith({ session: transaction.session });
  });

  it('auto-approves exact counts and handles zero-stock percentage boundaries', async () => {
    const exactPart = {
      _id: objectId('43'), part_name: 'Seal', part_number: 'P-1', quantity: 0
    };
    const positivePart = {
      _id: objectId('44'), part_name: 'Bearing', part_number: 'P-2', quantity: 0
    };
    const findOne = vi.spyOn(PartsModel, 'findOne')
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(exactPart) } as any)
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(positivePart) } as any);
    vi.spyOn(CycleCountModel.prototype, 'save').mockImplementation(async function (this: any) { return this; });
    vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);
    const update = vi.spyOn(PartsModel, 'findByIdAndUpdate').mockResolvedValue({} as any);
    vi.spyOn(partsService, 'getCycleCounts').mockResolvedValue([]);

    const exact = await partsService.createCycleCount(
      { part_id: String(exactPart._id), counted_quantity: 0 },
      objectId('45'), { _id: objectId('46') }
    );
    const exactDocument = (CycleCountModel.prototype.save as any).mock.instances[0] as any;
    expect(exact).toBe(exactDocument);
    expect(exactDocument).toMatchObject({ discrepancy_percent: 0, status: 'approved', barcode: '' });
    expect(update).toHaveBeenCalledWith(exactPart._id, expect.objectContaining({ updatedBy: objectId('46') }));

    await partsService.createCycleCount(
      { part_id: String(positivePart._id), counted_quantity: 2 },
      objectId('45'), { _id: objectId('46') }
    );
    const positiveDocument = (CycleCountModel.prototype.save as any).mock.instances[1] as any;
    expect(positiveDocument).toMatchObject({ discrepancy_percent: 100, status: 'pending-approval' });
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('rejects approval for a deleted part and avoids a movement for an unchanged approved count', async () => {
    const count: any = {
      _id: objectId('47'), part_id: objectId('48'), counted_quantity: 5,
      save: vi.fn(), toObject: () => ({ id: 'count' })
    };
    vi.spyOn(CycleCountModel, 'findOne')
      .mockReturnValueOnce(sessionQuery(count) as any)
      .mockReturnValueOnce(sessionQuery(count) as any);
    const findPart = vi.spyOn(PartsModel, 'findOne')
      .mockReturnValueOnce(sessionQuery(null) as any)
      .mockReturnValueOnce(sessionQuery({
        _id: count.part_id, part_name: 'Seal', quantity: 5,
        save: vi.fn().mockResolvedValue(undefined)
      }) as any);

    await expect(partsService.approveCycleCount(
      String(count._id), 'approved', objectId('49'), { _id: objectId('50') }
    )).rejects.toMatchObject({ message: 'Part not found for cycle count approval', status: 404 });

    const movement = vi.spyOn(InventoryMovementModel.prototype, 'save').mockResolvedValue({} as any);
    vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);
    count.save.mockResolvedValue(undefined);
    vi.spyOn(partsService, 'getCycleCounts').mockResolvedValue([]);
    await expect(partsService.approveCycleCount(
      String(count._id), 'approved', objectId('49'), { _id: objectId('50') }, 'Verified'
    )).resolves.toEqual({ id: 'count' });
    expect(movement).not.toHaveBeenCalled();
    expect(findPart).toHaveBeenCalledTimes(2);
  });

  it('covers medium/low replenishment ranking, filtering, and empty demand references', async () => {
    const mediumId = objectId('51');
    const lowId = objectId('52');
    const ignoredId = objectId('53');
    vi.spyOn(partsService, 'getAllParts').mockResolvedValue([
      { _id: mediumId, part_name: 'Medium', quantity: 6, min_quantity: 2, reorder_point: 2 },
      { id: lowId, part_name: 'Low', quantity: 1, min_quantity: 4, reorder_point: 4 },
      { _id: ignoredId, part_name: 'Healthy', quantity: 20, min_quantity: 2, reorder_point: 2 }
    ] as any);
    vi.spyOn(WorkOrderModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([
      { parts: [{ part_id: mediumId, plannedQuantity: 3 }, { part_id: 'invalid', plannedQuantity: 9 }] },
      { parts: null }
    ]) } as any);
    vi.spyOn(ProcedureModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([
      { required_parts: [{ part_id: '', quantity: 3 }] },
      { name: '', required_parts: [{ part_id: mediumId, quantity: 1 }] }
    ]) } as any);

    const suggestions = await partsService.getReplenishmentSuggestions(objectId('54'));
    expect(suggestions.map((item: any) => item.part_name)).toEqual(['Low', 'Medium']);
    expect(suggestions[0]).toMatchObject({ urgency: 'high', recommended_order_qty: 7 });
    expect(suggestions[1]).toMatchObject({
      urgency: 'medium', open_demand: 3, projected_available: 3,
      procedure_usage_count: 1, procedure_names: []
    });
  });
});
