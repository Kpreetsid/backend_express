import { Schema, model, Document, ObjectId } from 'mongoose';

export interface IWorkOrderAssignee extends Document {
  woId: ObjectId;
  userId: ObjectId;
}

const workOrderAssigneeSchema = new Schema<IWorkOrderAssignee>(
  {
    woId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    collection: 'wo_user_mapping',
    timestamps: true ,
    versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
  }
);

export const WorkOrderAssignee = model<IWorkOrderAssignee>('WorkOrderAssignee', workOrderAssigneeSchema);
