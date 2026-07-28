import mongoose from "mongoose";
import { helperService } from "../../utils/helper";
import { PartsModel, IPart } from "../../models/part.model";
import { withTransaction } from "../../utils/transaction.helper";
import { InventoryMovementModel, InventoryMovementType } from "../../models/inventoryMovement.model";
import { CycleCountModel } from "../../models/cycleCount.model";
import { ProcedureModel } from "../../models/procedure.model";
import { WorkOrderModel } from "../../models/workOrder.model";
import { PartsTypeModel } from "../../models/parts-types.model";
import { PartHistoryAction, PartHistoryModel } from "../../models/partHistory.model";
import { LocationModel } from "../../models/location.model";
import { UserModel } from "../../models/user.model";
import { assertSyncVersion, createSyncConflict } from "../../utils/sync-concurrency";

interface InventoryAdjustmentResult {
  warnings: {
    part_id: any;
    part_name: string;
    quantity: number;
    min_quantity: number;
  }[];
}

interface WorkOrderInventoryContext {
  account_id?: any;
  work_order_id?: any;
  work_order_no?: string;
  location_id?: any;
  previous_status?: string;
  next_status?: string;
  note?: string;
}

interface CycleCountPayload {
  part_id: string;
  counted_quantity: number;
  reason?: string;
}

interface PartsImportResult {
  imported: number;
  failed: number;
  total: number;
  errors: { row: number; message: string }[];
  data: IPart[];
}

interface PartHistoryPayload {
  account_id: any;
  part: any;
  action_type: PartHistoryAction;
  user?: any;
  note?: string;
  quantity?: number;
  stock_before?: number;
  stock_after?: number;
  metadata?: Record<string, any>;
}

class PartsService {
  private isExecutionStatus(status?: string): boolean {
    return ['In-Progress', 'Completed'].includes(String(status || '').trim());
  }

  private getPartIdValue(part: any): string | null {
    const rawPartId = part?.part_id || part?.id || part?._id || null;
    const partId = String(rawPartId || '').trim();
    return partId && mongoose.Types.ObjectId.isValid(partId) ? partId : null;
  }

  private getEstimatedQuantity(part: any): number {
    const quantity = Number(part?.estimatedQuantity ?? 0);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  }

  private getIssuedQuantity(part: any, status?: string): number {
    const explicitActual = Number(part?.actualQuantity);
    if (Number.isFinite(explicitActual) && explicitActual > 0) {
      return explicitActual;
    }
    return this.isCompletedStatus(status) ? this.getEstimatedQuantity(part) : 0;
  }

  private isCompletedStatus(status?: string): boolean {
    return String(status || '').trim() === 'Completed';
  }

  private getReservedImpact(part: any, status?: string): number {
    const estimatedQuantity = this.getEstimatedQuantity(part);
    if (this.isCompletedStatus(status)) {
      return 0;
    }
    if (this.isExecutionStatus(status)) {
      return Math.max(estimatedQuantity - this.getIssuedQuantity(part, status), 0);
    }
    return estimatedQuantity;
  }

  private getIssuedImpact(part: any, status?: string): number {
    if (this.isExecutionStatus(status)) {
      return this.getIssuedQuantity(part, status);
    }
    return 0;
  }

  private formatMovementActor(user: any): string {
    const firstName = String(user?.firstName || '').trim();
    const lastName = String(user?.lastName || '').trim();
    return `${firstName} ${lastName}`.trim() || String(user?.username || '').trim() || 'System';
  }

  private async createPartHistoryEntry(payload: PartHistoryPayload, session?: any): Promise<void> {
    const { account_id, part, action_type, user, note, quantity, stock_before, stock_after, metadata } = payload;
    if (!part?._id) {
      return;
    }

    const normalizedQuantity = Number(quantity);
    const normalizedStockBefore = Number(stock_before);
    const normalizedStockAfter = Number(stock_after);
    const historyEntry = new PartHistoryModel({
      account_id,
      part_id: part._id,
      part_name: part.part_name || '',
      part_number: part.part_number || '',
      ...(part.location_id ? { location_id: part.location_id } : {}),
      location_name: part.location?.location_name || metadata?.['location_name'] || '',
      action_type,
      ...(Number.isFinite(normalizedQuantity) ? { quantity: normalizedQuantity } : {}),
      ...(Number.isFinite(normalizedStockBefore) ? { stock_before: normalizedStockBefore } : {}),
      ...(Number.isFinite(normalizedStockAfter) ? { stock_after: normalizedStockAfter } : {}),
      note: String(note || '').trim(),
      metadata: metadata || {},
      ...(user?._id ? { actor_id: user._id } : {}),
      actor_name: this.formatMovementActor(user),
      visible: true
    });
    await historyEntry.save(session ? { session } : {});
  }

  private getChangedPartFields(previousPart: any, nextPayload: any): string[] {
    const fieldMap: Record<string, string> = {
      part_name: 'Part Name',
      part_number: 'Part Number',
      barcode: 'Barcode',
      description: 'Description',
      quantity: 'Quantity',
      min_quantity: 'Minimum Quantity',
      reorder_point: 'Reorder Point',
      cost: 'Unit Cost',
      preferred_vendor: 'Preferred Vendor',
      lead_time_days: 'Lead Time (Days)',
      unit: 'Unit',
      location_id: 'Location'
    };

    return Object.keys(fieldMap).filter((field) => {
      const beforeValue = previousPart?.[field];
      const afterValue = nextPayload?.[field];
      return String(beforeValue ?? '') !== String(afterValue ?? '');
    }).map((field) => fieldMap[field]!);
  }

  private normalizePartPayload(body: any): any {
    return {
      ...body,
      barcode: String(body?.barcode || '').trim() || undefined,
      reorder_point: Number.isFinite(Number(body?.reorder_point)) ? Number(body.reorder_point) : Number(body?.min_quantity || 0),
      preferred_vendor: String(body?.preferred_vendor || '').trim() || '',
      lead_time_days: Number.isFinite(Number(body?.lead_time_days)) ? Number(body.lead_time_days) : 0
    };
  }

  private async enrichPartNetwork(parts: any[]): Promise<any[]> {
    if (!parts.length) {
      return [];
    }

    const accountIds = Array.from(new Set(parts.map((part: any) => String(part.account_id || '')).filter(Boolean)));
    const partNumbers = Array.from(new Set(parts.map((part: any) => String(part.part_number || '').trim()).filter(Boolean)));
    const partIds = parts.map((part: any) => part._id);

    const [networkParts, recentMovements, recentHistory] = await Promise.all([
      PartsModel.aggregate([
        {
          $match: {
            visible: true,
            account_id: { $in: accountIds.map((id) => helperService.validateObjectId(id)) },
            part_number: { $in: partNumbers }
          }
        },
        {
          $lookup: {
            from: LocationModel.collection.name,
            let: { location_id: "$location_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$location_id"] }, visible: true } },
              { $project: { _id: 1, location_name: 1, location_type: 1 } }
            ],
            as: "location"
          }
        },
        { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            account_id: 1,
            part_name: 1,
            part_number: 1,
            barcode: 1,
            quantity: 1,
            min_quantity: 1,
            reorder_point: 1,
            preferred_vendor: 1,
            lead_time_days: 1,
            unit: 1,
            cost: 1,
            currency: 1,
            location_id: 1,
            last_counted_at: 1,
            location: {
              id: "$location._id",
              location_name: "$location.location_name",
              location_type: "$location.location_type"
            }
          }
        }
      ]),
      InventoryMovementModel.find({
        part_id: { $in: partIds },
        visible: true
      }).sort({ createdAt: -1 }).limit(Math.max(parts.length * 6, 12)).lean(),
      PartHistoryModel.find({
        part_id: { $in: partIds },
        visible: true
      }).sort({ createdAt: -1 }).limit(Math.max(parts.length * 8, 16)).lean()
    ]);

    const networkMap = new Map<string, any[]>();
    networkParts.forEach((networkPart: any) => {
      const key = `${String(networkPart.account_id)}::${String(networkPart.part_number || '').trim()}`;
      if (!networkMap.has(key)) {
        networkMap.set(key, []);
      }
      networkMap.get(key)?.push(networkPart);
    });

    const movementMap = new Map<string, any[]>();
    recentMovements.forEach((movement: any) => {
      const key = String(movement.part_id || '');
      if (!movementMap.has(key)) {
        movementMap.set(key, []);
      }
      if ((movementMap.get(key)?.length || 0) < 5) {
        movementMap.get(key)?.push(movement);
      }
    });

    const historyMap = new Map<string, any[]>();
    recentHistory.forEach((entry: any) => {
      const key = String(entry.part_id || '');
      if (!historyMap.has(key)) {
        historyMap.set(key, []);
      }
      if ((historyMap.get(key)?.length || 0) < 6) {
        historyMap.get(key)?.push(entry);
      }
    });

    return parts.map((part: any) => {
      const key = `${String(part.account_id)}::${String(part.part_number || '').trim()}`;
      const networkEntries = (networkMap.get(key) || []).sort((first: any, second: any) => Number(second.quantity || 0) - Number(first.quantity || 0));
      const stock_locations = networkEntries.map((entry: any) => ({
        id: String(entry._id),
        location_id: String(entry.location_id || ''),
        location_name: entry.location?.location_name || 'Unassigned',
        location_type: entry.location?.location_type || '',
        quantity: Number(entry.quantity || 0),
        min_quantity: Number(entry.min_quantity || 0),
        reorder_point: Number(entry.reorder_point || 0),
        preferred_vendor: entry.preferred_vendor || '',
        lead_time_days: Number(entry.lead_time_days || 0),
        last_counted_at: entry.last_counted_at || null,
        available_for_transfer: Number(entry.quantity || 0) > Number(entry.min_quantity || 0)
          ? Number(entry.quantity || 0) - Number(entry.min_quantity || 0)
          : 0
      }));
      const alternative_locations = stock_locations.filter((entry: any) => entry.id !== String(part._id));
      const totalNetworkQuantity = stock_locations.reduce((total: number, entry: any) => total + Number(entry.quantity || 0), 0);
      const preferredStockSource = alternative_locations.find((entry: any) => Number(entry.available_for_transfer || 0) > 0) || alternative_locations[0] || null;

      return {
        ...part,
        stock_locations,
        alternative_locations,
        network_location_count: stock_locations.length,
        network_on_hand: totalNetworkQuantity,
        preferred_stock_source: preferredStockSource,
        recent_movements: movementMap.get(String(part._id)) || [],
        recent_history: historyMap.get(String(part._id)) || []
      };
    });
  }

  private createMovementRecord(
    movementType: InventoryMovementType,
    quantity: number,
    stockBefore: number,
    stockAfter: number,
    context: WorkOrderInventoryContext,
    user: any,
    part: any
  ): any | null {
    const normalizedQuantity = Number(quantity || 0);
    if (!(normalizedQuantity > 0)) {
      return null;
    }

    return {
      account_id: context.account_id,
      part_id: part._id,
      part_name: part.part_name,
      work_order_id: context.work_order_id || null,
      work_order_no: context.work_order_no || '',
      location_id: part.location_id || context.location_id || null,
      movement_type: movementType,
      quantity: normalizedQuantity,
      stock_before: Number.isFinite(stockBefore) ? stockBefore : undefined,
      stock_after: Number.isFinite(stockAfter) ? stockAfter : undefined,
      note: context.note || '',
      createdBy: user?._id,
      createdByName: this.formatMovementActor(user),
      visible: true
    };
  }

  private buildLifecyclePart(part: any, status?: string): any {
    const estimatedQuantity = this.getEstimatedQuantity(part);
    const issuedQuantity = this.isExecutionStatus(status) ? this.getIssuedQuantity(part, status) : 0;
    const reservedQuantity = this.isCompletedStatus(status) ? 0 : Math.max(estimatedQuantity - issuedQuantity, 0);
    const returnedQuantity = this.isCompletedStatus(status) ? Math.max(estimatedQuantity - issuedQuantity, 0) : 0;
    const shortQuantity = this.isExecutionStatus(status) ? Math.max(issuedQuantity - estimatedQuantity, 0) : 0;

    let lifecycle_status: 'planned' | 'reserved' | 'issued' | 'returned' | 'short' = 'planned';
    if (shortQuantity > 0 || String(status || '').trim() === 'Waiting-on-Parts') {
      lifecycle_status = 'short';
    } else if (this.isCompletedStatus(status) && returnedQuantity > 0 && issuedQuantity === 0) {
      lifecycle_status = 'returned';
    } else if (issuedQuantity > 0) {
      lifecycle_status = 'issued';
    } else if (reservedQuantity > 0) {
      lifecycle_status = 'reserved';
    }

    return {
      ...part,
      part_id: this.getPartIdValue(part),
      part_type: part?.part_type || 'N/A',
      location_id: part?.location_id || null,
      location_name: part?.location_name || part?.location?.location_name || null,
      part_source: ['manual', 'procedure', 'mixed'].includes(String(part?.part_source || '').trim())
        ? String(part.part_source).trim()
        : 'manual',
      procedureNames: Array.isArray(part?.procedureNames)
        ? Array.from(new Set(part.procedureNames.map((name: any) => String(name || '').trim()).filter(Boolean)))
        : [],
      estimatedQuantity,
      actualQuantity: part?.actualQuantity ?? null,
      plannedQuantity: estimatedQuantity,
      reservedQuantity,
      issuedQuantity,
      returnedQuantity,
      shortQuantity,
      lifecycle_status
    };
  }

  normalizeWorkOrderParts(parts: any[] = [], status?: string): any[] {
    return (Array.isArray(parts) ? parts : []).map((part: any) => this.buildLifecyclePart(part, status));
  }

  async validateInventoryByWorkOrder(
    oldParts: any[] = [],
    newParts: any[] = [],
    previousStatus: string = 'Open',
    nextStatus: string = 'Open',
    session?: any
  ): Promise<void> {
    const normalizedOldParts = this.normalizeWorkOrderParts(oldParts, previousStatus);
    const normalizedNewParts = this.normalizeWorkOrderParts(newParts, nextStatus);
    const oldMap = new Map<string, any>();
    const newMap = new Map<string, any>();

    normalizedOldParts.forEach((part) => {
      const partId = this.getPartIdValue(part);
      if (partId) {
        oldMap.set(partId, part);
      }
    });
    normalizedNewParts.forEach((part) => {
      const partId = this.getPartIdValue(part);
      if (partId) {
        newMap.set(partId, part);
      }
    });

    const allPartIds = [...new Set([...oldMap.keys(), ...newMap.keys()])];

    for (const partId of allPartIds) {
      const oldPart = oldMap.get(partId) || null;
      const newPart = newMap.get(partId) || null;
      const oldReserved = this.getReservedImpact(oldPart, previousStatus);
      const newReserved = this.getReservedImpact(newPart, nextStatus);
      const oldIssued = this.getIssuedImpact(oldPart, previousStatus);
      const newIssued = this.getIssuedImpact(newPart, nextStatus);
      const netStockDelta = (oldReserved - newReserved) + (oldIssued - newIssued);

      if (netStockDelta >= 0) {
        continue;
      }

      const query = PartsModel.findById(partId);
      if (session) {
        query.session(session);
      }

      const part = await query;
      if (!part) {
        continue;
      }

      const availableQuantity = Number(part.quantity || 0);
      const requiredQuantity = Math.abs(netStockDelta);
      if (availableQuantity < requiredQuantity) {
        throw Object.assign(new Error(`Insufficient stock for ${part.part_name}`), { status: 400 });
      }
    }
  }

  async getAllParts(match: any): Promise<IPart[]> {
    match.visible = true;
    const parts = await PartsModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { location_id: "$location_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$location_id"] }, visible: true } },
            { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "location"
        }
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: PartsTypeModel.collection.name,
          let: { part_type_id: "$part_type" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$part_type_id"] }} },
            { $project: { _id: 1, id: "$_id", name: 1, description: 1} },
          ],
          as: "partTypeData"
        }
      },
      { $unwind: { path: "$partTypeData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { user_id: "$createdBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },
            { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_role: 1, user_status: 1, user_profile_img: 1 } },
          ],
          as: "createdUser"
        }
      },
      { $unwind: { path: "$createdUser", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { user_id: "$updatedBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },
            { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_role: 1, user_status: 1, user_profile_img: 1 } },
          ],
          as: "updatedUser"
        }
      },
      { $unwind: { path: "$updatedUser", preserveNullAndEmptyArrays: true } },
      { $addFields: { id: "$_id" } },
      { $sort: { _id: -1 } }
    ]);
    return await this.enrichPartNetwork(parts as any);
  };

  async getPartHistory(partId: string, account_id: any): Promise<any[]> {
    return await PartHistoryModel.find({
      account_id,
      part_id: helperService.validateObjectId(String(partId)),
      visible: true
    }).sort({ createdAt: -1 }).lean();
  }

  async insert(body: IPart, account_id: any, user: any): Promise<IPart> {
    const normalizedBody = this.normalizePartPayload(body);
    const created = await new PartsModel({
      account_id: account_id,
      part_name: normalizedBody.part_name,
      part_number: normalizedBody.part_number,
      barcode: normalizedBody.barcode,
      unit: normalizedBody.unit,
      description: normalizedBody.description,
      part_type: normalizedBody.part_type,
      quantity: normalizedBody.quantity,
      min_quantity: normalizedBody.min_quantity,
      reorder_point: normalizedBody.reorder_point,
      cost: normalizedBody.cost,
      preferred_vendor: normalizedBody.preferred_vendor,
      lead_time_days: normalizedBody.lead_time_days,
      location_id: normalizedBody.location_id,
      currency: normalizedBody.currency,
      createdBy: user?._id || user
    }).save();

    await this.createPartHistoryEntry({
      account_id,
      part: created,
      action_type: 'created',
      user,
      note: 'Part created.',
      quantity: created.quantity,
      stock_before: 0,
      stock_after: created.quantity,
      metadata: {
        location_name: ''
      }
    });

    return created;
  };

  async importParts(parts: any[], account_id: any, user_id: any): Promise<PartsImportResult> {
    const result: PartsImportResult = {
      imported: 0,
      failed: 0,
      total: parts.length,
      errors: [],
      data: []
    };

    for (let index = 0; index < parts.length; index++) {
      const rowNumber = index + 2;
      const part = parts[index] || {};

      try {
        const payload: any = {
          account_id,
          part_name: String(part.part_name || '').trim(),
          part_number: String(part.part_number || '').trim(),
          description: String(part.description || '').trim(),
          unit: String(part.unit || '').trim(),
          quantity: Number(part.quantity ?? 0),
          min_quantity: Number(part.min_quantity ?? 0),
          cost: Number(part.cost ?? 0),
          currency: String(part.currency || 'INR').trim(),
          createdBy: user_id
        };

        if (!payload.part_name) throw new Error('Part name is required');
        if (!payload.part_number) throw new Error('Part number is required');
        if (!payload.unit) throw new Error('Unit is required');
        if (!Number.isFinite(payload.quantity)) throw new Error('Quantity must be a number');
        if (!Number.isFinite(payload.min_quantity)) throw new Error('Minimum quantity must be a number');
        if (!Number.isFinite(payload.cost)) throw new Error('Cost must be a number');

        if (part.part_type) {
          payload.part_type = helperService.validateObjectId(String(part.part_type));
        }

        if (part.location_id) {
          payload.location_id = helperService.validateObjectId(String(part.location_id));
        }

        const created = await new PartsModel(payload).save();
        result.imported++;
        result.data.push(created);
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          message: error?.message || 'Failed to import part'
        });
      }
    }

    return result;
  }

  async updatePartById(id: string, body: IPart, user: any, account_id: any, expectedVersion?: number) {
    return await withTransaction(async (session) => {
      const normalizedBody: any = this.normalizePartPayload(body);
      const existingPart = await PartsModel.findOne({
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true
      }).session(session);

      if (!existingPart) {
        return null;
      }
      assertSyncVersion(existingPart, expectedVersion);

      const changedFields = this.getChangedPartFields(existingPart.toObject(), normalizedBody);
      normalizedBody.updatedBy = user?._id || user;

      const updateFilter: any = { _id: id, account_id, visible: true };
      if (expectedVersion !== undefined) updateFilter.sync_version = expectedVersion;
      delete normalizedBody.sync_version;
      const updatedPart = await PartsModel.findOneAndUpdate(updateFilter, normalizedBody, { returnDocument: 'after', session });
      if (!updatedPart && expectedVersion !== undefined) {
        throw createSyncConflict(await PartsModel.findById(id).session(session));
      }

      if (updatedPart && changedFields.length > 0) {
        await this.createPartHistoryEntry({
          account_id,
          part: updatedPart,
          action_type: 'updated',
          user,
          note: `Updated ${changedFields.join(', ')}.`,
          quantity: updatedPart.quantity,
          stock_before: existingPart.quantity,
          stock_after: updatedPart.quantity,
          metadata: {
            changed_fields: changedFields
          }
        }, session);
      }

      return updatedPart;
    });
  };

  async updatePartStock(id: string, body: any, user: any, account_id: any) {
    return await withTransaction(async (session) => {
      const part = await PartsModel.findOne({
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true
      }).session(session);

      if (!part) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }

      const mode = String(body?.mode || 'add').trim();
      const rawQuantity = Number(body?.quantity);
      const note = String(body?.note || body?.reason || '').trim();
      const destinationPartId = body?.destination_part_id ? helperService.validateObjectId(String(body.destination_part_id)) : null;

      if (!Number.isFinite(rawQuantity)) {
        throw Object.assign(new Error('Please provide a valid stock quantity'), { status: 400 });
      }
      if (!note) {
        throw Object.assign(new Error('Reason / note is required for stock adjustments'), { status: 400 });
      }

      const stockBefore = Number(part.quantity || 0);
      let stockAfter = stockBefore;
      let movementQuantity = 0;

      if (mode === 'transfer') {
        if (!destinationPartId) {
          throw Object.assign(new Error('Please select a destination location for the transfer'), { status: 400 });
        }
        if (String(destinationPartId) === String(part._id)) {
          throw Object.assign(new Error('Source and destination locations must be different'), { status: 400 });
        }
        if (rawQuantity <= 0) {
          throw Object.assign(new Error('Please enter a quantity greater than zero'), { status: 400 });
        }
        if (stockBefore < rawQuantity) {
          throw Object.assign(new Error(`Cannot transfer ${rawQuantity}. Only ${stockBefore} in stock.`), { status: 400 });
        }

        const destinationPart = await PartsModel.findOne({
          _id: destinationPartId,
          account_id,
          visible: true
        }).session(session);

        if (!destinationPart) {
          throw Object.assign(new Error('Destination part record not found'), { status: 404 });
        }

        if (String(destinationPart.part_number || '').trim() !== String(part.part_number || '').trim()) {
          throw Object.assign(new Error('Destination location must belong to the same part number'), { status: 400 });
        }

        const destinationStockBefore = Number(destinationPart.quantity || 0);
        const destinationStockAfter = destinationStockBefore + rawQuantity;

        stockAfter = stockBefore - rawQuantity;
        movementQuantity = rawQuantity;

        part.quantity = stockAfter;
        part.updatedBy = user?._id || user;
        destinationPart.quantity = destinationStockAfter;
        destinationPart.updatedBy = user?._id || user;

        await part.save({ session });
        await destinationPart.save({ session });

        const transferMovements = [
          new InventoryMovementModel({
            account_id,
            part_id: part._id,
            part_name: part.part_name,
            ...(part.location_id ? { location_id: part.location_id } : {}),
            movement_type: 'transfer-out',
            quantity: movementQuantity,
            stock_before: stockBefore,
            stock_after: stockAfter,
            note: note || `Transferred to ${destinationPart.part_name} @ destination location`,
            createdBy: user?._id || user,
            createdByName: this.formatMovementActor(user),
            visible: true
          }),
          new InventoryMovementModel({
            account_id,
            part_id: destinationPart._id,
            part_name: destinationPart.part_name,
            ...(destinationPart.location_id ? { location_id: destinationPart.location_id } : {}),
            movement_type: 'transfer-in',
            quantity: movementQuantity,
            stock_before: destinationStockBefore,
            stock_after: destinationStockAfter,
            note: note || `Transferred from ${part.part_name} @ source location`,
            createdBy: user?._id || user,
            createdByName: this.formatMovementActor(user),
            visible: true
          })
        ];
        for (const movement of transferMovements) {
          await movement.save({ session });
        }

        await this.createPartHistoryEntry({
          account_id,
          part,
          action_type: 'transfer-out',
          user,
          note,
          quantity: movementQuantity,
          stock_before: stockBefore,
          stock_after: stockAfter,
          metadata: {
            destination_part_id: String(destinationPart._id),
            destination_location_id: String(destinationPart.location_id || ''),
            destination_part_name: destinationPart.part_name,
            destination_location_name: destinationPart.location_id ? undefined : ''
          }
        }, session);

        await this.createPartHistoryEntry({
          account_id,
          part: destinationPart,
          action_type: 'transfer-in',
          user,
          note,
          quantity: movementQuantity,
          stock_before: destinationStockBefore,
          stock_after: destinationStockAfter,
          metadata: {
            source_part_id: String(part._id),
            source_location_id: String(part.location_id || ''),
            source_part_name: part.part_name
          }
        }, session);

        return part;
      } else if (mode === 'set') {
        if (rawQuantity < 0) {
          throw Object.assign(new Error('Stock quantity cannot be negative'), { status: 400 });
        }
        stockAfter = rawQuantity;
        movementQuantity = Math.abs(stockAfter - stockBefore);
      } else if (mode === 'remove') {
        if (rawQuantity <= 0) {
          throw Object.assign(new Error('Please enter a quantity greater than zero'), { status: 400 });
        }
        if (stockBefore < rawQuantity) {
          throw Object.assign(new Error(`Cannot remove ${rawQuantity}. Only ${stockBefore} in stock.`), { status: 400 });
        }
        stockAfter = stockBefore - rawQuantity;
        movementQuantity = rawQuantity;
      } else {
        if (rawQuantity <= 0) {
          throw Object.assign(new Error('Please enter a quantity greater than zero'), { status: 400 });
        }
        stockAfter = stockBefore + rawQuantity;
        movementQuantity = rawQuantity;
      }

      part.quantity = stockAfter;
      part.updatedBy = user?._id || user;
      await part.save({ session });

      if (movementQuantity > 0) {
        const movement = new InventoryMovementModel({
          account_id,
          part_id: part._id,
          part_name: part.part_name,
          ...(part.location_id ? { location_id: part.location_id } : {}),
          movement_type: 'adjust',
          quantity: movementQuantity,
          stock_before: stockBefore,
          stock_after: stockAfter,
          note: note || `Manual stock adjustment (${mode})`,
          createdBy: user?._id || user,
          createdByName: this.formatMovementActor(user),
          visible: true
        });
        await movement.save({ session });

        const actionType: PartHistoryAction = mode === 'remove'
          ? 'stock-removed'
          : mode === 'set'
            ? 'stock-set'
            : 'stock-added';

        await this.createPartHistoryEntry({
          account_id,
          part,
          action_type: actionType,
          user,
          note,
          quantity: movementQuantity,
          stock_before: stockBefore,
          stock_after: stockAfter
        }, session);
      }

      return part;
    });
  }

  async removeById(id: string, user_id: any) {
    return await PartsModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { returnDocument: 'after' });
  };

  async assignPartToWorkOrder(body: any, user: any) {
    await Promise.all(
      body.map(async (doc: any) => {
        const data = await PartsModel.findOne({ _id: helperService.validateObjectId(String(doc.part_id)) });
        if (!data) return;
        data.quantity = data.quantity - doc.estimatedQuantity;
        data.updatedBy = user._id;
        await data.save();
      })
    );
    return true;
  };

  async revertPartFromWorkOrder(oldParts: any, newParts: any, user: any) {
    const oldMap = new Map();
    const newMap = new Map();
    oldParts.forEach((p: any) => oldMap.set(String(p.part_id), Number(p.estimatedQuantity)));
    newParts.forEach((p: any) => newMap.set(String(p.part_id), Number(p.estimatedQuantity)));
    const allPartIds = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]));
    for (const partId of allPartIds) {
      const oldQty = oldMap.get(partId) || 0;
      const newQty = newMap.get(partId) || 0;
      if (oldQty === newQty) continue;
      const part = await PartsModel.findById(partId);
      if (!part) continue;
      if (oldQty > 0 && newQty === 0) {
        part.quantity += oldQty;
      }
      if (oldQty === 0 && newQty > 0) {
        if (part.quantity < newQty) {
          throw Object.assign(new Error(`Not enough quantity for ${part.part_name}`), { status: 400 });
        }
        part.quantity -= newQty;
      }
      if (oldQty > newQty) {
        const diff = oldQty - newQty;
        part.quantity += diff;
      }
      if (newQty > oldQty) {
        const diff = newQty - oldQty;
        if (part.quantity < diff) {
          throw Object.assign(new Error(`Insufficient inventory for ${part.part_name}`), { status: 400 });
        }
        part.quantity -= diff;
      }
      part.updatedBy = user._id;
      await part.save();
    }
  };

  async adjustInventoryByWorkOrder(oldParts: any[] = [], newParts: any[] = [], user: any, session?: any, context: WorkOrderInventoryContext = {}): Promise<InventoryAdjustmentResult> {
    const previousStatus = context.previous_status || 'Open';
    const nextStatus = context.next_status || 'Open';
    const normalizedOldParts = this.normalizeWorkOrderParts(oldParts, previousStatus);
    const normalizedNewParts = this.normalizeWorkOrderParts(newParts, nextStatus);
    const oldMap = new Map<string, any>();
    const newMap = new Map<string, any>();
    const warnings: InventoryAdjustmentResult["warnings"] = [];

    normalizedOldParts.forEach((part) => {
      const partId = this.getPartIdValue(part);
      if (partId) {
        oldMap.set(partId, part);
      }
    });
    normalizedNewParts.forEach((part) => {
      const partId = this.getPartIdValue(part);
      if (partId) {
        newMap.set(partId, part);
      }
    });

    const allPartIds = [...new Set([...oldMap.keys(), ...newMap.keys()])];

    const executeAdjustments = async (s: any) => {
      for (const partId of allPartIds) {
        const oldPart = oldMap.get(partId) || null;
        const newPart = newMap.get(partId) || null;
        const oldReserved = this.getReservedImpact(oldPart, previousStatus);
        const newReserved = this.getReservedImpact(newPart, nextStatus);
        const oldIssued = this.getIssuedImpact(oldPart, previousStatus);
        const newIssued = this.getIssuedImpact(newPart, nextStatus);
        const reserveDelta = newReserved - oldReserved;
        const issueDelta = newIssued - oldIssued;
        const netStockDelta = (oldReserved - newReserved) + (oldIssued - newIssued);

        if (reserveDelta === 0 && issueDelta === 0) continue;

        const part = await PartsModel.findById(partId).session(s);
        if (!part) continue;

        if (netStockDelta < 0 && part.quantity < Math.abs(netStockDelta)) {
          throw Object.assign(new Error(`Insufficient stock for ${part.part_name}`), { status: 400 });
        }

        const stockBefore = Number(part.quantity || 0);
        part.quantity += netStockDelta;
        part.updatedBy = user._id;

        await part.save({ session: s });

        let runningStock = stockBefore;
        const movements: any[] = [];

        if (!this.isCompletedStatus(previousStatus) && !this.isCompletedStatus(nextStatus)) {
          if (reserveDelta > 0) {
            runningStock -= reserveDelta;
            movements.push(this.createMovementRecord('reserve', reserveDelta, stockBefore, runningStock, context, user, part));
          } else if (reserveDelta < 0 && issueDelta <= 0) {
            runningStock += Math.abs(reserveDelta);
            movements.push(this.createMovementRecord('release', Math.abs(reserveDelta), stockBefore, runningStock, context, user, part));
          }

          if (issueDelta > 0) {
            const issueAfter = netStockDelta < 0 ? runningStock - Math.max(issueDelta - Math.max(oldReserved - newReserved, 0), 0) : runningStock;
            movements.push(this.createMovementRecord('issue', issueDelta, runningStock, issueAfter, context, user, part));
            runningStock = issueAfter;
          } else if (issueDelta < 0) {
            movements.push(this.createMovementRecord('return', Math.abs(issueDelta), runningStock, runningStock, context, user, part));
          }
        } else if (!this.isCompletedStatus(previousStatus) && this.isCompletedStatus(nextStatus)) {
          const completionIssued = newIssued;
          const completionReturn = Math.max(oldReserved - newIssued, 0);
          const extraIssue = Math.max(newIssued - oldReserved, 0);

          if (completionIssued > 0) {
            const issuedAfter = runningStock - extraIssue;
            movements.push(this.createMovementRecord('issue', completionIssued, runningStock, issuedAfter, context, user, part));
            runningStock = issuedAfter;
          }

          if (completionReturn > 0) {
            const returnAfter = runningStock + completionReturn;
            movements.push(this.createMovementRecord('return', completionReturn, runningStock, returnAfter, context, user, part));
            runningStock = returnAfter;
          }
        } else if (this.isCompletedStatus(previousStatus) && this.isCompletedStatus(nextStatus)) {
          if (issueDelta > 0) {
            const issuedAfter = runningStock - issueDelta;
            movements.push(this.createMovementRecord('issue', issueDelta, runningStock, issuedAfter, context, user, part));
            runningStock = issuedAfter;
          } else if (issueDelta < 0) {
            const returnAfter = runningStock + Math.abs(issueDelta);
            movements.push(this.createMovementRecord('return', Math.abs(issueDelta), runningStock, returnAfter, context, user, part));
            runningStock = returnAfter;
          }
        } else if (this.isCompletedStatus(previousStatus) && !this.isCompletedStatus(nextStatus)) {
          const reopenedReserveDelta = newReserved - oldIssued;
          if (reopenedReserveDelta > 0) {
            const reserveAfter = runningStock - reopenedReserveDelta;
            movements.push(this.createMovementRecord('reserve', reopenedReserveDelta, runningStock, reserveAfter, context, user, part));
            runningStock = reserveAfter;
          } else if (reopenedReserveDelta < 0) {
            const releaseAfter = runningStock + Math.abs(reopenedReserveDelta);
            movements.push(this.createMovementRecord('release', Math.abs(reopenedReserveDelta), runningStock, releaseAfter, context, user, part));
            runningStock = releaseAfter;
          }
        }

        const validMovements = movements.filter(Boolean);
        if (validMovements.length > 0 && context.account_id) {
          await InventoryMovementModel.insertMany(validMovements, { session: s });
        }

        if (part.quantity <= part.min_quantity) {
          warnings.push({
            part_id: part._id,
            part_name: part.part_name,
            quantity: part.quantity,
            min_quantity: part.min_quantity
          });
        }
      }
      return { warnings };
    };

    if (session) {
      return await executeAdjustments(session);
    }

    return await withTransaction(executeAdjustments);
  }

  async getCycleCounts(match: any): Promise<any[]> {
    const counts = await CycleCountModel.aggregate([
      { $match: { ...match, visible: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { location_id: "$location_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$location_id"] }, visible: true } },
            { $project: { _id: 1, location_name: 1, location_type: 1 } }
          ],
          as: "location"
        }
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          id: "$_id",
          location: {
            id: "$location._id",
            location_name: "$location.location_name",
            location_type: "$location.location_type"
          }
        }
      }
    ]);

    return counts;
  }

  async createCycleCount(body: CycleCountPayload, account_id: any, user: any): Promise<any> {
    const part = await PartsModel.findOne({
      _id: helperService.validateObjectId(String(body.part_id)),
      account_id,
      visible: true
    }).lean();

    if (!part) {
      throw Object.assign(new Error('Part not found'), { status: 404 });
    }
    const systemQuantity = Number(part.quantity || 0);
    const countedQuantity = Number(body.counted_quantity || 0);
    const discrepancyQuantity = countedQuantity - systemQuantity;
    const discrepancyPercent = systemQuantity > 0 ? Number((((discrepancyQuantity) / systemQuantity) * 100).toFixed(2)) : (countedQuantity > 0 ? 100 : 0);

    const count = await new CycleCountModel({
      account_id,
      part_id: part._id,
      part_name: part.part_name,
      part_number: part.part_number,
      barcode: part.barcode || '',
      location_id: part.location_id,
      system_quantity: systemQuantity,
      counted_quantity: countedQuantity,
      discrepancy_quantity: discrepancyQuantity,
      discrepancy_percent: discrepancyPercent,
      status: discrepancyQuantity === 0 ? 'approved' : 'pending-approval',
      reason: String(body.reason || '').trim(),
      createdBy: user._id,
      createdByName: this.formatMovementActor(user)
    }).save();

    await this.createPartHistoryEntry({
      account_id,
      part,
      action_type: 'cycle-count-submitted',
      user,
      note: String(body.reason || '').trim() || 'Cycle count submitted.',
      quantity: countedQuantity,
      stock_before: systemQuantity,
      stock_after: countedQuantity,
      metadata: {
        discrepancy_quantity: discrepancyQuantity,
        discrepancy_percent: discrepancyPercent
      }
    });

    if (discrepancyQuantity === 0) {
      await PartsModel.findByIdAndUpdate(part._id, { last_counted_at: new Date(), updatedBy: user._id });
    }

    const [enriched] = await this.getCycleCounts({ _id: count._id, account_id });
    return enriched || count;
  }

  async approveCycleCount(id: string, decision: 'approved' | 'rejected', account_id: any, user: any, approvalNotes?: string): Promise<any> {
    return await withTransaction(async (session) => {
      const count = await CycleCountModel.findOne({
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true
      }).session(session);

      if (!count) {
        throw Object.assign(new Error('Cycle count not found'), { status: 404 });
      }

      count.status = decision;
      count.approval_notes = String(approvalNotes || '').trim();
      count.reviewedBy = user._id;
      count.reviewedByName = this.formatMovementActor(user);
      count.reviewedAt = new Date();

      if (decision === 'approved') {
        const part = await PartsModel.findOne({
          _id: count.part_id,
          account_id,
          visible: true
        }).session(session);

        if (!part) {
          throw Object.assign(new Error('Part not found for cycle count approval'), { status: 404 });
        }

        const stockBefore = Number(part.quantity || 0);
        const stockAfter = Number(count.counted_quantity || 0);
        if (stockBefore !== stockAfter) {
          const movement = new InventoryMovementModel({
            account_id,
            part_id: part._id,
            part_name: part.part_name,
            ...(part.location_id ? { location_id: part.location_id } : {}),
            movement_type: 'count-adjustment',
            quantity: Math.abs(stockAfter - stockBefore),
            stock_before: stockBefore,
            stock_after: stockAfter,
            note: `Cycle count approved${count.reason ? `: ${count.reason}` : ''}`,
            createdBy: user._id,
            createdByName: this.formatMovementActor(user),
            visible: true
          });
          await movement.save({ session });
        }

        part.quantity = stockAfter;
        part.last_counted_at = new Date();
        part.updatedBy = user._id;
        await part.save({ session });

        await this.createPartHistoryEntry({
          account_id,
          part,
          action_type: 'cycle-count-approved',
          user,
          note: String(approvalNotes || '').trim() || `Cycle count approved${count.reason ? `: ${count.reason}` : ''}`,
          quantity: Math.abs(stockAfter - stockBefore),
          stock_before: stockBefore,
          stock_after: stockAfter,
          metadata: {
            counted_quantity: Number(count.counted_quantity || 0),
            discrepancy_quantity: Number(count.discrepancy_quantity || 0)
          }
        }, session);
      } else {
        await this.createPartHistoryEntry({
          account_id,
          part: {
            _id: count.part_id,
            part_name: count.part_name,
            part_number: count.part_number,
            location_id: count.location_id
          },
          action_type: 'cycle-count-rejected',
          user,
          note: String(approvalNotes || '').trim() || 'Cycle count rejected.',
          quantity: Number(count.counted_quantity || 0),
          stock_before: Number(count.system_quantity || 0),
          stock_after: Number(count.system_quantity || 0),
          metadata: {
            counted_quantity: Number(count.counted_quantity || 0),
            discrepancy_quantity: Number(count.discrepancy_quantity || 0)
          }
        }, session);
      }

      await count.save({ session });
      const [enriched] = await this.getCycleCounts({ _id: count._id, account_id });
      return enriched || count.toObject();
    });
  }

  async getReplenishmentSuggestions(account_id: any): Promise<any[]> {
    const [parts, openOrders, procedures] = await Promise.all([
      this.getAllParts({ account_id, visible: true }),
      WorkOrderModel.find({
        account_id,
        visible: true,
        status: { $in: ['Open', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'In-Progress', 'On-Hold'] }
      }, {
        parts: 1,
        status: 1,
        wo_location_id: 1
      }).lean(),
      ProcedureModel.find({
        account_id,
        visible: true,
        is_latest: true
      }, {
        required_parts: 1,
        name: 1
      }).lean()
    ]);

    const demandMap = new Map<string, number>();
    openOrders.forEach((order: any) => {
      (order.parts || []).forEach((part: any) => {
        const partId = this.getPartIdValue(part);
        if (!partId) {
          return;
        }
        const planned = Number(part.reservedQuantity ?? part.estimatedQuantity ?? part.plannedQuantity ?? 0);
        demandMap.set(partId, Number(demandMap.get(partId) || 0) + Math.max(planned, 0));
      });
    });

    const procedureUsageMap = new Map<string, { count: number; quantity: number; names: string[] }>();
    procedures.forEach((procedure: any) => {
      (procedure.required_parts || []).forEach((requiredPart: any) => {
        const partId = String(requiredPart?.part_id || '').trim();
        if (!partId) {
          return;
        }
        const current = procedureUsageMap.get(partId) || { count: 0, quantity: 0, names: [] };
        current.count += 1;
        current.quantity += Number(requiredPart?.quantity || 0);
        if (procedure?.name) {
          current.names.push(String(procedure.name));
        }
        procedureUsageMap.set(partId, current);
      });
    });

    return parts
      .map((part: any) => {
        const reorderPoint = Number(part.reorder_point || part.min_quantity || 0);
        const openDemand = Number(demandMap.get(String(part.id || part._id)) || 0);
        const onHand = Number(part.quantity || 0);
        const projectedAvailable = onHand - openDemand;
        const minimumTarget = Math.max(reorderPoint, Number(part.min_quantity || 0));
        const suggestedOrderQty = Math.max((minimumTarget * 2) - projectedAvailable, 0);
        const procedureUsage = procedureUsageMap.get(String(part.id || part._id)) || { count: 0, quantity: 0, names: [] };
        const stockoutRiskDays = part.lead_time_days && projectedAvailable < minimumTarget
          ? Math.max(Number(part.lead_time_days || 0) - Math.max(Math.floor(projectedAvailable / Math.max(openDemand || 1, 1)), 0), 0)
          : 0;
        const urgency = projectedAvailable <= 0
          ? 'critical'
          : projectedAvailable <= minimumTarget
            ? 'high'
            : openDemand > 0
              ? 'medium'
              : 'low';

        return {
          part_id: String(part.id || part._id),
          part_name: part.part_name,
          part_number: part.part_number,
          barcode: part.barcode || '',
          location: part.location,
          quantity: onHand,
          open_demand: openDemand,
          projected_available: projectedAvailable,
          reorder_point: reorderPoint,
          min_quantity: Number(part.min_quantity || 0),
          recommended_order_qty: suggestedOrderQty,
          preferred_vendor: part.preferred_vendor || '',
          lead_time_days: Number(part.lead_time_days || 0),
          stockout_risk_days: stockoutRiskDays,
          urgency,
          network_on_hand: Number(part.network_on_hand || onHand),
          alternative_locations: part.alternative_locations || [],
          preferred_stock_source: part.preferred_stock_source || null,
          procedure_usage_count: procedureUsage.count,
          procedure_required_quantity: procedureUsage.quantity,
          procedure_names: Array.from(new Set(procedureUsage.names)).slice(0, 5)
        };
      })
      .filter((suggestion: any) => suggestion.recommended_order_qty > 0 || suggestion.open_demand > suggestion.quantity)
      .sort((first: any, second: any) => {
        const urgencyRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (urgencyRank[first.urgency] ?? Number.MAX_SAFE_INTEGER) - (urgencyRank[second.urgency] ?? Number.MAX_SAFE_INTEGER)
          || second.recommended_order_qty - first.recommended_order_qty;
      });
  }
}

export const partsService = new PartsService();
