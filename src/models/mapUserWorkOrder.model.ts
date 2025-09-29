import { Schema, model, Document, ObjectId } from 'mongoose';

export interface IWorkOrderAssignee extends Document {
  woId: ObjectId;
  userId: ObjectId;
}

const workOrderAssigneeSchema = new Schema<IWorkOrderAssignee>(
  {
    woId: { type: Schema.Types.ObjectId, ref: 'Schema_WorkOrder', required: true }, // fixed ref
    userId: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  },
  {
    collection: 'wo_user_mapping',
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const WorkOrderAssigneeModel = model<IWorkOrderAssignee>('Schema_WorkOrderAssignee', workOrderAssigneeSchema);

