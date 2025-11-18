import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { IUpload } from './upload.model';

interface ITroubleshootingSteps {
  title: string;
  description: string;
  files: IUpload[];
  id: number;
  Position: number;
}

const TroubleshootingStepsSchema = new Schema<ITroubleshootingSteps>({
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true, required: true },
  files: { type: [Object], required: true },
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
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true },
    tags: { type: String, trim: true },
    type: { type: String, trim: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
    troubleshooting_steps: { type: [TroubleshootingStepsSchema], required: true },
    visible: { type: Boolean, required: true, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
  },
  {
    collection: 'troubleshoot_guide',
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

export const TroubleshootGuideModel = mongoose.model<ITroubleshootGuide>('Schema_TroubleshootGuide', troubleshootGuideSchema);