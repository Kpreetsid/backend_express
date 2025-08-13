import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IWorkOrder extends Document {
    account_id: ObjectId;
    work_order_no: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    startDate: Date;
    dueDate: Date;
    estimatedTime: string;
    category: string;
    locationId: ObjectId;
    assetId: ObjectId;
    assignedTo: ObjectId[];
    files: object[];
    requestId: ObjectId;
    completedBy: ObjectId;
    completedDate: Date;
    isActive: boolean;
    createdBy: ObjectId;
    updatedBy?: ObjectId;
}

const WorkOrderSchema = new Schema<IWorkOrder>({
    account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    work_order_no: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['Open', 'In-Progress', 'On-Hold', 'Completed'], default: 'Open' },
    priority: { type: String, enum: ['None', 'Low', 'Medium', 'High'], default: 'None' },
    startDate: { type: Date },
    dueDate: { type: Date },
    estimatedTime: { type: String },
    category: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    assignedTo: { type: [Schema.Types.ObjectId], ref: 'User' },
    files: { type: [Schema.Types.Mixed] },
    requestId: { type: Schema.Types.ObjectId, ref: 'WorkRequest' },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedDate: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
    collection: 'mst_workOrder',
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform(doc: any, ret: any) {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        }
    }
});

export const WorkOrder = mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema);
