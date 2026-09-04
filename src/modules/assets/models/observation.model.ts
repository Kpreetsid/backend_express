import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const OBSERVATION_COLLECTION_NAME = 'observation';
import { OBSERVATION_STATUSES } from '../policies/observation.policy';

export interface IObservation extends Document {
  observation: string;
  recommendation: string;
  faults: string[];
  files: Array<Object>;
  createdOn: Date;
  assetId: ObjectId;
  report_id?: ObjectId;
  accountId: ObjectId;
  status: string;
  userId: ObjectId;
  alarmId: number;
  locationId: ObjectId;
  top_level_asset_id: ObjectId;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId
}

const ObservationSchema = new Schema<IObservation>({
  observation: { type: String, trim: true, required: true },
  recommendation: { type: String, trim: true, required: true },
  faults: { type: [String] },
  files: { type: [Object] },
  createdOn: { type: Date, default: Date.now },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  report_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportAssetModel' },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  status: { type: String, trim: true, enum: OBSERVATION_STATUSES, required: true },
  alarmId: { type: Number },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  top_level_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: OBSERVATION_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

ObservationSchema.index({ accountId: 1, visible: 1, assetId: 1, _id: -1 });
ObservationSchema.index({ accountId: 1, visible: 1, alarmId: 1, _id: -1 });

export const ObservationModel = mongoose.model<IObservation>('Schema_Observation', ObservationSchema);
