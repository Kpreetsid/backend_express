import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InventoryMovementModel } from '../../models/inventoryMovement.model';
import { PartHistoryModel } from '../../models/partHistory.model';
import { PartsModel } from '../../models/part.model';
import { partsService } from './parts.service';

const service = partsService as any;

const objectId = (suffix: string) => new mongoose.Types.ObjectId(`507f1f77bcf86cd7994390${suffix}`);

const leanQuery = (result: any[]) => ({
  sort: vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(result)
    })
  })
});

describe('parts deterministic inventory helpers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes identifiers, quantities, actors, and editable payload fields', () => {
    const partId = objectId('11');

    expect(service.isExecutionStatus(' In-Progress ')).toBe(true);
    expect(service.isExecutionStatus('Open')).toBe(false);
    expect(service.getPartIdValue({ part_id: partId })).toBe(String(partId));
    expect(service.getPartIdValue({ id: 'invalid' })).toBeNull();
    expect(service.getEstimatedQuantity({ estimatedQuantity: '2.5' })).toBe(2.5);
    expect(service.getEstimatedQuantity({ estimatedQuantity: -1 })).toBe(0);
    expect(service.getIssuedQuantity({ actualQuantity: '1.5' }, 'In-Progress')).toBe(1.5);
    expect(service.getIssuedQuantity({ estimatedQuantity: 3 }, 'Completed')).toBe(3);
    expect(service.getIssuedQuantity({ estimatedQuantity: 3 }, 'Open')).toBe(0);
    expect(service.getReservedImpact({ estimatedQuantity: 5, actualQuantity: 2 }, 'In-Progress')).toBe(3);
    expect(service.getReservedImpact({ estimatedQuantity: 5 }, 'Completed')).toBe(0);
    expect(service.getIssuedImpact({ actualQuantity: 2 }, 'Open')).toBe(0);
    expect(service.getIssuedImpact({ actualQuantity: 2 }, 'In-Progress')).toBe(2);

    expect(service.formatMovementActor({ firstName: ' Ada ', lastName: ' Lovelace ' }))
      .toBe('Ada Lovelace');
    expect(service.formatMovementActor({ username: 'operator' })).toBe('operator');
    expect(service.formatMovementActor({})).toBe('System');

    expect(service.normalizePartPayload({
      barcode: '  BC-1 ', min_quantity: '4', preferred_vendor: ' Vendor ', lead_time_days: '3'
    })).toMatchObject({
      barcode: 'BC-1', reorder_point: 4, preferred_vendor: 'Vendor', lead_time_days: 3
    });
    expect(service.normalizePartPayload({ barcode: ' ', reorder_point: 'bad', lead_time_days: 'bad' }))
      .toMatchObject({ barcode: undefined, reorder_point: 0, preferred_vendor: '', lead_time_days: 0 });

    expect(service.getChangedPartFields(
      { part_name: 'Seal', quantity: 5, unit: 'EA' },
      { part_name: 'Seal Kit', quantity: 5, unit: 'BOX' }
    )).toEqual(['Part Name', 'Unit']);
  });

  it('derives work-order part lifecycle without mutating API payload fields', () => {
    const partId = objectId('12');
    const planned = service.normalizeWorkOrderParts([{
      part_id: partId,
      estimatedQuantity: 5,
      part_source: 'procedure',
      procedureNames: ['Inspection', ' Inspection ', '', 'Lubrication'],
      location: { location_name: 'Plant A' }
    }], 'Open')[0];
    expect(planned).toMatchObject({
      part_id: String(partId),
      part_type: 'N/A',
      part_source: 'procedure',
      procedureNames: ['Inspection', 'Lubrication'],
      plannedQuantity: 5,
      reservedQuantity: 5,
      issuedQuantity: 0,
      returnedQuantity: 0,
      shortQuantity: 0,
      lifecycle_status: 'reserved',
      location_name: 'Plant A'
    });

    expect(service.buildLifecyclePart({ estimatedQuantity: 5, actualQuantity: 2 }, 'Completed'))
      .toMatchObject({ issuedQuantity: 2, returnedQuantity: 3, lifecycle_status: 'issued' });
    expect(service.buildLifecyclePart({ estimatedQuantity: 5, actualQuantity: 0 }, 'Completed'))
      .toMatchObject({ returnedQuantity: 5, lifecycle_status: 'returned' });
    expect(service.buildLifecyclePart({ estimatedQuantity: 2, actualQuantity: 4 }, 'In-Progress'))
      .toMatchObject({ shortQuantity: 2, lifecycle_status: 'short' });
    expect(service.buildLifecyclePart({ estimatedQuantity: 2 }, 'Waiting-on-Parts'))
      .toMatchObject({ lifecycle_status: 'short' });
    expect(service.normalizeWorkOrderParts(null, 'Open')).toEqual([]);
  });

  it('creates positive inventory movement records and rejects zero-impact entries', () => {
    const partId = objectId('13');
    expect(service.createMovementRecord('issue', 0, 5, 5, {}, {}, { _id: partId })).toBeNull();
    expect(service.createMovementRecord(
      'issue', 2, 5, 3,
      { account_id: 'account', work_order_id: 'work-order', work_order_no: 'WO-1', note: 'issued' },
      { _id: 'user', firstName: 'Grace', lastName: 'Hopper' },
      { _id: partId, part_name: 'Seal', location_id: 'location' }
    )).toEqual({
      account_id: 'account',
      part_id: partId,
      part_name: 'Seal',
      work_order_id: 'work-order',
      work_order_no: 'WO-1',
      location_id: 'location',
      movement_type: 'issue',
      quantity: 2,
      stock_before: 5,
      stock_after: 3,
      note: 'issued',
      createdBy: 'user',
      createdByName: 'Grace Hopper',
      visible: true
    });
  });

  it('validates only negative net stock changes and reports insufficient named stock', async () => {
    const partId = objectId('14');
    const findById = vi.spyOn(PartsModel, 'findById');

    await service.validateInventoryByWorkOrder(
      [{ part_id: partId, estimatedQuantity: 5 }],
      [{ part_id: partId, estimatedQuantity: 2 }],
      'Open',
      'Open'
    );
    expect(findById).not.toHaveBeenCalled();

    findById.mockResolvedValueOnce({ quantity: 2, part_name: 'Bearing' } as any);
    await expect(service.validateInventoryByWorkOrder(
      [],
      [{ part_id: partId, estimatedQuantity: 3 }],
      'Open',
      'Open'
    )).rejects.toMatchObject({ message: 'Insufficient stock for Bearing', status: 400 });

    findById.mockResolvedValueOnce({ quantity: 3, part_name: 'Bearing' } as any);
    await expect(service.validateInventoryByWorkOrder(
      [],
      [{ part_id: partId, estimatedQuantity: 3 }],
      'Open',
      'Open'
    )).resolves.toBeUndefined();
  });

  it('enriches network stock, transfer preference, movement, and history in bounded batches', async () => {
    const partId = objectId('15');
    const alternativeId = objectId('16');
    const accountId = objectId('17');
    const basePart = {
      _id: partId,
      account_id: accountId,
      part_name: 'Seal',
      part_number: 'P-1',
      quantity: 2
    };

    vi.spyOn(PartsModel, 'aggregate').mockResolvedValue([
      { ...basePart, location_id: 'loc-a', quantity: 2, min_quantity: 1, location: { location_name: 'A' } },
      {
        ...basePart,
        _id: alternativeId,
        location_id: 'loc-b',
        quantity: 10,
        min_quantity: 3,
        location: { location_name: 'B', location_type: 'Store' }
      }
    ] as any);
    vi.spyOn(InventoryMovementModel, 'find').mockReturnValue(leanQuery([
      { part_id: partId, movement_type: 'issue', quantity: 1 },
      { part_id: partId, movement_type: 'return', quantity: 1 }
    ]) as any);
    vi.spyOn(PartHistoryModel, 'find').mockReturnValue(leanQuery([
      { part_id: partId, action_type: 'updated' }
    ]) as any);

    const [enriched] = await service.enrichPartNetwork([basePart]);
    expect(enriched).toMatchObject({
      network_location_count: 2,
      network_on_hand: 12,
      preferred_stock_source: { id: String(alternativeId), available_for_transfer: 7 },
      recent_movements: [{ movement_type: 'issue' }, { movement_type: 'return' }],
      recent_history: [{ action_type: 'updated' }]
    });
    expect(enriched.stock_locations.map((entry: any) => entry.location_name)).toEqual(['B', 'A']);
    expect(enriched.alternative_locations).toHaveLength(1);
    expect(await service.enrichPartNetwork([])).toEqual([]);
  });

  it('creates and imports normalized parts while returning row-specific validation failures', async () => {
    const partsSave = vi.spyOn(PartsModel.prototype, 'save').mockImplementation(async function (this: any) {
      if (!this._id) this._id = objectId('18');
      return this;
    });
    vi.spyOn(PartHistoryModel.prototype, 'save').mockResolvedValue({} as any);

    const created = await service.insert({
      part_name: 'Seal',
      part_number: 'P-1',
      unit: 'EA',
      quantity: 5,
      min_quantity: 2,
      barcode: '  B-1 '
    }, objectId('19'), { _id: objectId('20'), firstName: 'Store', lastName: 'Owner' });
    expect(created).toMatchObject({ part_name: 'Seal', barcode: 'B-1', reorder_point: 2 });

    const result = await service.importParts([
      { part_name: 'Bearing', part_number: 'P-2', unit: 'EA', quantity: '4', min_quantity: '1', cost: '2' },
      { part_number: 'P-3', unit: 'EA' },
      { part_name: 'Belt', part_number: 'P-4', unit: 'EA', quantity: 'not-a-number' },
      { part_name: 'Motor', part_number: 'P-5', unit: 'EA', part_type: 'invalid-object-id' }
    ], objectId('21'), objectId('22'));

    expect(result).toMatchObject({ imported: 1, failed: 3, total: 4 });
    expect(result.errors).toEqual([
      { row: 3, message: 'Part name is required' },
      { row: 4, message: 'Quantity must be a number' },
      { row: 5, message: 'Invalid ObjectId: invalid-object-id' }
    ]);
    expect(partsSave).toHaveBeenCalledTimes(2);
  });

  it('returns aggregate, history, soft-delete, and legacy assignment results without contract changes', async () => {
    const partId = objectId('23');
    const aggregate = vi.spyOn(PartsModel, 'aggregate').mockResolvedValue([{ _id: partId, part_name: 'Seal' }] as any);
    const enrich = vi.spyOn(service, 'enrichPartNetwork').mockResolvedValue([{ _id: partId, enriched: true }]);
    const match: any = { account_id: objectId('24') };
    await expect(service.getAllParts(match)).resolves.toEqual([{ _id: partId, enriched: true }]);
    expect(match.visible).toBe(true);
    expect(aggregate).toHaveBeenCalledOnce();
    expect(enrich).toHaveBeenCalledOnce();

    const historyQuery = { sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ action_type: 'created' }]) }) };
    vi.spyOn(PartHistoryModel, 'find').mockReturnValue(historyQuery as any);
    await expect(service.getPartHistory(String(partId), objectId('25')))
      .resolves.toEqual([{ action_type: 'created' }]);

    vi.spyOn(PartsModel, 'findByIdAndUpdate').mockResolvedValue({ _id: partId, visible: false } as any);
    await expect(service.removeById(String(partId), objectId('26')))
      .resolves.toMatchObject({ visible: false });

    const assignedPart: any = { quantity: 8, save: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(PartsModel, 'findOne')
      .mockResolvedValueOnce(assignedPart)
      .mockResolvedValueOnce(null);
    await expect(service.assignPartToWorkOrder([
      { part_id: partId, estimatedQuantity: 3 },
      { part_id: objectId('27'), estimatedQuantity: 1 }
    ], { _id: objectId('28') })).resolves.toBe(true);
    expect(assignedPart.quantity).toBe(5);
    expect(assignedPart.save).toHaveBeenCalledOnce();
  });

  it('applies each legacy work-order inventory delta exactly once', async () => {
    const returnedId = objectId('29');
    const issuedId = objectId('30');
    const increasedId = objectId('31');
    const unchangedId = objectId('32');
    const parts = new Map<string, any>([
      [String(returnedId), { part_name: 'Returned', quantity: 1, save: vi.fn().mockResolvedValue(undefined) }],
      [String(issuedId), { part_name: 'Issued', quantity: 10, save: vi.fn().mockResolvedValue(undefined) }],
      [String(increasedId), { part_name: 'Increased', quantity: 1, save: vi.fn().mockResolvedValue(undefined) }]
    ]);
    const findById = vi.spyOn(PartsModel, 'findById')
      .mockImplementation(((id: any) => Promise.resolve(parts.get(String(id)) || null)) as any);

    await service.revertPartFromWorkOrder(
      [
        { part_id: returnedId, estimatedQuantity: 4 },
        { part_id: increasedId, estimatedQuantity: 2 },
        { part_id: unchangedId, estimatedQuantity: 1 }
      ],
      [
        { part_id: issuedId, estimatedQuantity: 3 },
        { part_id: increasedId, estimatedQuantity: 3 },
        { part_id: unchangedId, estimatedQuantity: 1 }
      ],
      { _id: objectId('33') }
    );

    expect(parts.get(String(returnedId)).quantity).toBe(5);
    expect(parts.get(String(issuedId)).quantity).toBe(7);
    expect(parts.get(String(increasedId)).quantity).toBe(0);
    expect(findById.mock.calls.map(([id]) => String(id))).not.toContain(String(unchangedId));
  });
});
