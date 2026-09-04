import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';
export const WORK_ORDER_ACTIVITY_COLLECTION_NAME = 'work_order_activity';


export const WORK_ORDER_ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'status-changed',
  'assignees-updated',
  'parts-updated',
  'procedures-updated',
  'execution-updated',
  'tasks-updated',
  'attachments-added',
  'sop-submitted',
  'comment-added',
  'comment-updated',
  'comment-deleted',
  'child-created',
  'deleted'
] as const;

export type WorkOrderActivityAction = typeof WORK_ORDER_ACTIVITY_ACTIONS[number];

export interface IWorkOrderActivity extends Document {
  account_id: ObjectId;
  work_order_id: ObjectId;
  order_no?: string;
  title?: string;
  action_type: WorkOrderActivityAction;
  note?: string;
  metadata?: Record<string, any>;
  actor_id?: ObjectId;
  actor_name?: string;
  visible: boolean;
}

const workOrderActivitySchema = new Schema<IWorkOrderActivity>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true, index: true },
  work_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_WorkOrder', required: true, index: true },
  order_no: { type: String, trim: true },
  title: { type: String, trim: true },
  action_type: { type: String, enum: WORK_ORDER_ACTIVITY_ACTIONS, required: true, index: true },
  note: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_User' },
  actor_name: { type: String, trim: true },
  visible: { type: Boolean, default: true }
}, {
  collection: WORK_ORDER_ACTIVITY_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

workOrderActivitySchema.index({ account_id: 1, work_order_id: 1, createdAt: -1 });

export const WorkOrderActivityModel = mongoose.model<IWorkOrderActivity>('Schema_WorkOrderActivity', workOrderActivitySchema);
