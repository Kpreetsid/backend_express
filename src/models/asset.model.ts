import mongoose, { Schema, ObjectId, Document } from 'mongoose';

export interface IStage {
  gear_ratio: number;
  rpm: number;
  torque: number;
}

export interface ILocationData {
  location_name: string;
  id: string;
  assigned_to?: string;
}

export interface IAsset extends Document {
  asset_name: string;
  asset_id: string;
  asset_type: string;
  asset_model: string;
  asset_orient?: string;
  asset_behavior?: string;
  asset_frequency?: string;
  mounting: string;
  bladeCount: string;
  powUnit: string;
  brandModel: string;
  pinionGearTeethCount: string;
  timingGearTeethCount: string;
  minRotation: string;
  maxRotation: string;
  specificFrequency: string[];
  minInputRotation: string;
  maxInputRotation: string;
  minOutputRotation: string;
  maxOutputRotation: string;
  drivingPulleyDia: string;
  drivenPulleyDia: string;
  impellerBladeCount: string;
  beltLength: string;
  outputRPM: string;
  noOfGrooves: string;
  bearingType: string;
  rotationUnit: string;
  top_level: boolean;
  locationId: ObjectId;
  account_id: ObjectId;
  parent_id: ObjectId;
  powerRating: string;
  top_level_asset_id: ObjectId;
  description: string;
  manufacturer: string;
  year: string;
  brandMake: string;
  visible: boolean;
  isActive: boolean;
  assigned_to: number;
  image_path: string;
  noStages: number;
  qr_code: string;
  stageList: IStage[];
  createdBy: ObjectId;
}

const StageSchema = new Schema<IStage>({
  gear_ratio: { type: Number, required: true },
  rpm: { type: Number, required: true },
  torque: { type: Number, required: true },
}, { _id: false });

const assetSchema = new Schema<IAsset>({
  asset_name: { type: String, required: true },
  asset_id: { type: String, default: '' },
  asset_type: { type: String },
  asset_orient: { type: String },
  asset_behavior: { type: String },
  asset_frequency: { type: String },
  mounting: { type: String },
  bladeCount: { type: String },
  powUnit: { type: String },
  brandModel: { type: String },
  pinionGearTeethCount: { type: String },
  timingGearTeethCount: { type: String },
  minRotation: { type: String },
  maxRotation: { type: String },
  specificFrequency: { type: [String], default: null },
  minInputRotation: { type: String },
  maxInputRotation: { type: String },
  minOutputRotation: { type: String },
  maxOutputRotation: { type: String },
  drivingPulleyDia: { type: String },
  drivenPulleyDia: { type: String },
  impellerBladeCount: { type: String },
  beltLength: { type: String },
  outputRPM: { type: String },
  noOfGrooves: { type: String },
  bearingType: { type: String },
  rotationUnit: { type: String },
  top_level: { type: Boolean, default: false },
  locationId: { type: Schema.Types.ObjectId },
  account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId},
  parent_id: { type: Schema.Types.ObjectId, default: null },
  description: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  year: { type: String, default: '' },
  asset_model: { type: String, default: '' },
  qr_code: { type: String, default: '' },
  assigned_to: { type: Number, default: 1 },
  image_path: { type: String, default: '' },
  visible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  brandMake: { type: String, default: '' },
  powerRating: { type: String, default: '' },
  noStages: { type: Number, default: 0 },
  stageList: [StageSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  collection: 'asset_master',
  timestamps: true,
  versionKey: false
});

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);
