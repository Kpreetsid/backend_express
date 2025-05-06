import { Schema, model, Document } from 'mongoose';

export interface IWorkOrderAssignee extends Document {
  woId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
}

const workOrderAssigneeSchema = new Schema<IWorkOrderAssignee>(
  {
    woId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    collection: 'wo_user_mapping',
    timestamps: true 
  }
);

export const WorkOrderAssignee = model<IWorkOrderAssignee>('WorkOrderAssignee', workOrderAssigneeSchema);
