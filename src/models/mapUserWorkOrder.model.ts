import { Schema, model, Document, ObjectId } from 'mongoose';

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
    collection: 'wo_user_mapping',
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function (doc: any, ret: any) {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      }
    }
  }
);

export const WorkOrderAssigneeModel = model<IWorkOrderAssignee>('Schema_WorkOrderAssignee', workOrderAssigneeSchema);
