import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
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
  assetId?: ObjectId;
  locationId?: ObjectId;
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
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  WI_steps: { type: [WorkInstructionsStepsSchema] },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'work_instructions',
  timestamps: true,
  versionKey: false
});

export const WorkInstructions = mongoose.model<IWorkInstructions>('Schema_WorkInstructions', WorkInstructionsSchema);
