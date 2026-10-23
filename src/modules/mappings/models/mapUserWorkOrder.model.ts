import { Schema, model, Document } from 'mongoose';
import { ObjectId } from "mongodb";
export const MAP_USER_WORK_ORDER_COLLECTION_NAME = 'wo_user_mapping';


export interface IWorkOrderAssignee extends Document {
  woId: ObjectId;
  userId: ObjectId;
}

const workOrderAssigneeSchema = new Schema<IWorkOrderAssignee>(
  {
    woId: { type: Schema.Types.ObjectId, ref: 'WorkOrderModel', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  },
  {
    collection: MAP_USER_WORK_ORDER_COLLECTION_NAME,
    timestamps: true,
    versionKey: false
  }
);

workOrderAssigneeSchema.index({ woId: 1, userId: 1 }, { unique: true });
workOrderAssigneeSchema.index({ userId: 1 });

export const WorkOrderAssigneeModel = model<IWorkOrderAssignee>('Schema_WorkOrderAssignee', workOrderAssigneeSchema);
