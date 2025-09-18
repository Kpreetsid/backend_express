import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IObservation extends Document {
  observation: string;
  recommendation: string;
  faults: string[];
  files: Record<string, any>;
  createdOn: Date;
  assetId: ObjectId;
  accountId: ObjectId;
  status: string;
  user: any;
  userId: ObjectId;
  alarmId: number;
  locationId: ObjectId;
  top_level_asset_id: ObjectId;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId
}

const ObservationSchema = new Schema<IObservation>({
  observation: { type: String, required: true },
  recommendation: { type: String, required: true },
  faults: { type: [String] },
  files: { type: Schema.Types.Mixed, default: {} },
  createdOn: { type: Date, default: Date.now },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  status: { type: String, required: true },
  user: { type: Schema.Types.Mixed, required: true },
  alarmId: { type: Number },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  top_level_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'observation',
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

export const ObservationModel = mongoose.model<IObservation>('Schema_Observation', ObservationSchema);
