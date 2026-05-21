import mongoose from "mongoose";
import { helperService } from "../../utils/helper";
import { PartsModel, IPart } from "../../models/part.model";
import { withTransaction } from "../../utils/transaction.helper";
import { InventoryMovementModel, InventoryMovementType } from "../../models/inventoryMovement.model";
import { CycleCountModel } from "../../models/cycleCount.model";
import { ProcedureModel } from "../../models/procedure.model";
import { WorkOrderModel } from "../../models/workOrder.model";

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

    const [networkParts, recentMovements] = await Promise.all([
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
            from: "location_master",
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
      }).sort({ createdAt: -1 }).limit(Math.max(parts.length * 6, 12)).lean()
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
        recent_movements: movementMap.get(String(part._id)) || []
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
      location_id: context.location_id || part.location_id || null,
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

  async getAllParts(match: any): Promise<IPart[]> {
    match.visible = true;
    const parts = await PartsModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "location_master",
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
          from: "mst_part_types",
          let: { part_type_id: "$part_type" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$part_type_id"] }, visible: true } },
            { $project: { _id: 1, id: "$_id", name: 1, description: 1, visible: 1 } },
          ],
          as: "part_type"
        }
      },
      { $unwind: { path: "$part_type", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
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
          from: "users",
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

  async insert(body: IPart, account_id: any, user_id: any): Promise<IPart> {
    const normalizedBody = this.normalizePartPayload(body);
    return await new PartsModel({
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
      createdBy: user_id
    }).save();
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

  async updatePartById(id: string, body: IPart, user_id: any) {
    const normalizedBody: any = this.normalizePartPayload(body);
    normalizedBody.updatedBy = user_id;
    return await PartsModel.findByIdAndUpdate(id, normalizedBody, { returnDocument: 'after' });
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

      if (!Number.isFinite(rawQuantity)) {
        throw Object.assign(new Error('Please provide a valid stock quantity'), { status: 400 });
      }

      const stockBefore = Number(part.quantity || 0);
      let stockAfter = stockBefore;
      let movementQuantity = 0;

      if (mode === 'set') {
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
        await InventoryMovementModel.create([{
          account_id,
          part_id: part._id,
          part_name: part.part_name,
          location_id: part.location_id,
          movement_type: 'adjust',
          quantity: movementQuantity,
          stock_before: stockBefore,
          stock_after: stockAfter,
          note: note || `Manual stock adjustment (${mode})`,
          createdBy: user?._id || user,
          createdByName: this.formatMovementActor(user),
          visible: true
        }], { session });
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
          from: "location_master",
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

    const count = await CycleCountModel.create({
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
          await InventoryMovementModel.create([{
            account_id,
            part_id: part._id,
            part_name: part.part_name,
            location_id: part.location_id,
            movement_type: 'count-adjustment',
            quantity: Math.abs(stockAfter - stockBefore),
            stock_before: stockBefore,
            stock_after: stockAfter,
            note: `Cycle count approved${count.reason ? `: ${count.reason}` : ''}`,
            createdBy: user._id,
            createdByName: this.formatMovementActor(user),
            visible: true
          }], { session });
        }

        part.quantity = stockAfter;
        part.last_counted_at = new Date();
        part.updatedBy = user._id;
        await part.save({ session });
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
        return urgencyRank[first.urgency] - urgencyRank[second.urgency] || second.recommended_order_qty - first.recommended_order_qty;
      });
  }
}

export const partsService = new PartsService();
