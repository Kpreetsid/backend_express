import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { IUpload } from '../../upload/models/upload.model';
export const WORK_INSTRUCTIONS_COLLECTION_NAME = 'work_instructions';


export interface IWorkInstructionsSteps extends Document {
  title: string;
  description: string;
  image: IUpload[];
  id: number;
  Position: number;
}

const WorkInstructionsStepsSchema = new Schema<IWorkInstructionsSteps>({
  title: { type: String, trim: true, required: true, maxlength: 160 },
  description: { type: String, trim: true, required: true, maxlength: 5000 },
  image: { type: [Object], default: [] },
  id: { type: Number, required: true },
  Position: { type: Number, required: true }
}, { _id: false });

export interface IWorkInstructions extends Document {
  account_id: ObjectId;
  assetId?: ObjectId;
  locationId?: ObjectId;
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
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_Asset' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_Location' },
  title: { type: String, trim: true, required: true, maxlength: 160 },
  tag: { type: String, trim: true, maxlength: 40 },
  description: { type: String, trim: true, maxlength: 2000 },
  WI_steps: {
    type: [WorkInstructionsStepsSchema],
    required: true,
    validate: [(value: any[]) => value.length >= 1 && value.length <= 25, 'A guide must contain between 1 and 25 steps']
  },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: WORK_INSTRUCTIONS_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

WorkInstructionsSchema.index({ account_id: 1, assetId: 1, visible: 1, createdAt: -1 });
WorkInstructionsSchema.index({ account_id: 1, locationId: 1, visible: 1, createdAt: -1 });

export const WorkInstructions = mongoose.model<IWorkInstructions>('Schema_WorkInstructions', WorkInstructionsSchema);
