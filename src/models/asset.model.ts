import mongoose, { Schema, ObjectId, Document } from 'mongoose';

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
  stage_1st_driving_teeth?: number,
  stage_1st_driven_teeth?: number,
  stage_2nd_driving_teeth?: number,
  stage_2nd_driven_teeth?: number,
  stage_3rd_driving_teeth?: number,
  stage_3rd_driven_teeth?: number,
  stage_4th_driving_teeth?: number,
  stage_4th_driven_teeth?: number,
  stage_5th_driving_teeth?: number,
  stage_5th_driven_teeth?: number,
  stage_6th_driving_teeth?: number,
  stage_6th_driven_teeth?: number,
  stage_7th_driving_teeth?: number,
  stage_7th_driven_teeth?: number,
  stage_8th_driving_teeth?: number,
  stage_8th_driven_teeth?: number,
  createdBy: ObjectId;
}

const assetSchema = new Schema<IAsset>({
  asset_name: { type: String, required: true },
  asset_id: { type: String },
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
  specificFrequency: { type: [String] },
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
  parent_id: { type: Schema.Types.ObjectId },
  description: { type: String },
  manufacturer: { type: String },
  year: { type: String },
  asset_model: { type: String },
  qr_code: { type: String },
  assigned_to: { type: Number, default: 1 },
  image_path: { type: String },
  visible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  brandMake: { type: String },
  powerRating: { type: String },
  noStages: { type: Number },
  stage_1st_driving_teeth: { type: Number },
  stage_1st_driven_teeth: { type: Number },
  stage_2nd_driving_teeth: { type: Number },
  stage_2nd_driven_teeth: { type: Number },
  stage_3rd_driving_teeth: { type: Number },
  stage_3rd_driven_teeth: { type: Number },
  stage_4th_driving_teeth: { type: Number },
  stage_4th_driven_teeth: { type: Number },
  stage_5th_driving_teeth: { type: Number },
  stage_5th_driven_teeth: { type: Number },
  stage_6th_driving_teeth: { type: Number },
  stage_6th_driven_teeth: { type: Number },
  stage_7th_driving_teeth: { type: Number },
  stage_7th_driven_teeth: { type: Number },
  stage_8th_driving_teeth: { type: Number },
  stage_8th_driven_teeth: { type: Number },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  collection: 'asset_master',
  timestamps: true,
  versionKey: false
});

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);
