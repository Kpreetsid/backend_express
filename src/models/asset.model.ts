import mongoose, { Schema, ObjectId, Document } from 'mongoose';

export const ASSETS_TYPE = ['Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox', 'Fan_Blower', 'Pumps', 'Compressor', 'Chillers', 'Other'];

export interface IAsset extends Document {
  asset_name: string;
  asset_id: string;
  asset_type: string;
  asset_model: string;
  asset_orient?: string;
  asset_behavior?: string;
  asset_frequency?: string;
  asset_timezone: string;
  isNewFlow: boolean;
  equipment_id: ObjectId;
  loadType: string;
  mounting: string;
  bladeCount: string;
  powUnit: string;
  brandModel: string;
  pinionGearTeethCount: string;
  timingGearTeethCount: string;
  minInputRotation: string;
  rotation_type: string;
  motorType: string;
  maxInputRotation: string;
  brandId: string;
  brand: string;
  mountType: string;
  specificFrequency: string[];
  imageNodeData: object;
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
  pump_model: string;
  impellerType: string;
  lineFreq: string;
  element: string;
  noOfGroove: string;
  account_id: ObjectId;
  parent_id: ObjectId;
  powerRating: string;
  top_level_asset_id: ObjectId;
  drivingPulleyDiaUnit: string;
  description: string;
  manufacturer: string;
  casing: string;
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
  updatedBy: ObjectId;
}

const assetSchema = new Schema<IAsset>({
  asset_name: { type: String, required: true },
  asset_id: { type: String },
  asset_type: { type: String, enum: ASSETS_TYPE, required: true },
  asset_model: { type: String },
  asset_orient: { type: String },
  asset_behavior: { type: String },
  asset_frequency: { type: String },
  asset_timezone: { type: String },
  imageNodeData: { type: Object },
  isNewFlow: { type: Boolean },
  equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
  loadType: { type: String },
  motorType: { type: String },
  lineFreq: { type: String },
  mounting: { type: String },
  bladeCount: { type: String },
  powUnit: { type: String },
  casing: { type: String },
  element: { type: String },
  brand: { type: String },
  brandId: { type: String },
  brandModel: { type: String },
  pinionGearTeethCount: { type: String },
  timingGearTeethCount: { type: String },
  minInputRotation: { type: String },
  maxInputRotation: { type: String },
  rotation_type: { type: String },
  mountType: { type: String },
  specificFrequency: { type: [String] },
  minOutputRotation: { type: String },
  maxOutputRotation: { type: String },
  drivingPulleyDia: { type: String },
  drivenPulleyDia: { type: String },
  impellerBladeCount: { type: String },
  drivingPulleyDiaUnit: { type: String },
  beltLength: { type: String },
  outputRPM: { type: String },
  noOfGroove: { type: String },
  noOfGrooves: { type: String },
  bearingType: { type: String },
  pump_model: { type: String },
  impellerType: { type: String },
  rotationUnit: { type: String },
  top_level: { type: Boolean, default: false },
  locationId: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  parent_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  description: { type: String },
  manufacturer: { type: String },
  year: { type: String },
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
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'asset_master',
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

export const AssetModel = mongoose.model<IAsset>('Schema_Asset', assetSchema);
