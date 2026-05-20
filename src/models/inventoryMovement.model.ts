import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export const INVENTORY_MOVEMENT_TYPES = ['reserve', 'release', 'issue', 'return', 'short', 'adjust', 'count-adjustment'] as const;
export type InventoryMovementType = typeof INVENTORY_MOVEMENT_TYPES[number];

export interface IInventoryMovement extends Document {
  account_id: ObjectId;
  part_id: ObjectId;
  part_name?: string;
  work_order_id?: ObjectId;
  work_order_no?: string;
  location_id?: ObjectId;
  movement_type: InventoryMovementType;
  quantity: number;
  stock_before?: number;
  stock_after?: number;
  note?: string;
  createdBy: ObjectId;
  createdByName?: string;
  visible: boolean;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true, index: true },
  part_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_Part', required: true, index: true },
  part_name: { type: String, trim: true },
  work_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_WorkOrder', index: true },
  work_order_no: { type: String, trim: true },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', index: true },
  movement_type: { type: String, enum: INVENTORY_MOVEMENT_TYPES, required: true, index: true },
  quantity: { type: Number, required: true },
  stock_before: { type: Number },
  stock_after: { type: Number },
  note: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  createdByName: { type: String, trim: true },
  visible: { type: Boolean, default: true }
}, {
  collection: 'inventory_movements',
  timestamps: true,
  versionKey: false
});

inventoryMovementSchema.index({ account_id: 1, part_id: 1, createdAt: -1 });
inventoryMovementSchema.index({ account_id: 1, work_order_id: 1, createdAt: -1 });

export const InventoryMovementModel = mongoose.model<IInventoryMovement>('Schema_InventoryMovement', inventoryMovementSchema);
