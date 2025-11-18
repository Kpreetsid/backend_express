import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { IUpload } from './upload.model';

export interface IWorkInstructionsSteps extends Document {
  title: string;
  description: string;
  image: IUpload[];
  id: number;
  Position: number;
}

const WorkInstructionsStepsSchema = new Schema<IWorkInstructionsSteps>({
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true, required: true },
  image: { type: [Object], required: true },
  id: { type: Number, required: true },
  Position: { type: Number, required: true }
}, { _id: false });

export interface IWorkInstructions extends Document {
  account_id: ObjectId;
  title: string;
  tag: string;
  description: string;
  WI_steps: IWorkInstructionsSteps[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

const WorkInstructionsSchema = new Schema<IWorkInstructions>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  title: { type: String, trim: true },
  tag: { type: String, trim: true },
  description: { type: String, trim: true },
  WI_steps: { type: [WorkInstructionsStepsSchema] },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'work_instructions',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const WorkInstructions = mongoose.model<IWorkInstructions>('Schema_WorkInstructions', WorkInstructionsSchema);
