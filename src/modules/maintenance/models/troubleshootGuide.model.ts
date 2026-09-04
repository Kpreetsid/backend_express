import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { IUpload } from '../../upload/models/upload.model';
export const TROUBLESHOOT_GUIDE_COLLECTION_NAME = 'troubleshoot_guide';


interface ITroubleshootingSteps {
  title: string;
  description: string;
  image: IUpload[];
  files?: IUpload[];
  id: number;
  Position: number;
}

const TroubleshootingStepsSchema = new Schema<ITroubleshootingSteps>({
  title: { type: String, trim: true, required: true, maxlength: 160 },
  description: { type: String, trim: true, required: true, maxlength: 5000 },
  image: { type: [Object], default: [] },
  files: { type: [Object], default: undefined },
  id: { type: Number, required: true },
  Position: { type: Number, required: true }
}, { _id: false });

export interface ITroubleshootGuide extends Document {
  account_id: ObjectId;
  title: string;
  description?: string;
  tags?: string;
  type?: string;
  assetId?: ObjectId;
  locationId?: ObjectId;
  troubleshooting_steps: ITroubleshootingSteps[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const troubleshootGuideSchema = new Schema<ITroubleshootGuide>(
  {
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
    title: { type: String, trim: true, required: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000 },
    tags: { type: String, trim: true, maxlength: 40 },
    type: { type: String, trim: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
    troubleshooting_steps: {
      type: [TroubleshootingStepsSchema],
      required: true,
      validate: [(value: any[]) => value.length >= 1 && value.length <= 25, 'A guide must contain between 1 and 25 steps']
    },
    visible: { type: Boolean, required: true, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
  },
  {
    collection: TROUBLESHOOT_GUIDE_COLLECTION_NAME,
    timestamps: true,
    versionKey: false
  }
);

troubleshootGuideSchema.index({ account_id: 1, visible: 1 });
troubleshootGuideSchema.index({ account_id: 1, assetId: 1, visible: 1, createdAt: -1 });
troubleshootGuideSchema.index({ account_id: 1, locationId: 1, visible: 1, createdAt: -1 });

export const TroubleshootGuideModel = mongoose.model<ITroubleshootGuide>('Schema_TroubleshootGuide', troubleshootGuideSchema);
