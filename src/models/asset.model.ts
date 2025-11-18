import mongoose, { Schema, ObjectId, Document } from 'mongoose';

export const ASSETS_TYPE = ['Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox', 'Fan_Blower', 'Pumps', 'Compressor', 'Chillers', 'CNC', 'Other'];

export interface IAsset extends Document {
  asset_name: string;
  asset_id: string;
  asset_type: string;
  asset_model: string;
  asset_orient?: string;
  asset_behavior?: string;
  asset_frequency?: string;
  asset_timezone: string;
  asset_build_type: string;
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
  asset_name: { type: String, required: true, trim: true },
  asset_id: { type: String, trim: true },
  asset_type: { type: String, trim: true, enum: ASSETS_TYPE, required: true },
  asset_model: { type: String, trim: true },
  asset_orient: { type: String, trim: true },
  asset_behavior: { type: String, trim: true },
  asset_frequency: { type: String, trim: true },
  asset_timezone: { type: String, trim: true, default: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Calcutta' },
  asset_build_type: { type: String, trim: true, required: true },
  imageNodeData: { type: Object },
  isNewFlow: { type: Boolean },
  equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
  loadType: { type: String, trim: true },
  motorType: { type: String, trim: true },
  lineFreq: { type: String, trim: true },
  mounting: { type: String, trim: true },
  bladeCount: { type: String, trim: true },
  powUnit: { type: String, trim: true },
  casing: { type: String, trim: true },
  element: { type: String, trim: true },
  brand: { type: String, trim: true },
  brandId: { type: String, trim: true },
  brandModel: { type: String, trim: true },
  pinionGearTeethCount: { type: String, trim: true },
  timingGearTeethCount: { type: String, trim: true },
  minInputRotation: { type: String, trim: true },
  maxInputRotation: { type: String, trim: true },
  rotation_type: { type: String, trim: true },
  mountType: { type: String, trim: true },
  specificFrequency: { type: [String] },
  minOutputRotation: { type: String, trim: true },
  maxOutputRotation: { type: String, trim: true },
  drivingPulleyDia: { type: String, trim: true },
  drivenPulleyDia: { type: String, trim: true },
  impellerBladeCount: { type: String, trim: true },
  drivingPulleyDiaUnit: { type: String, trim: true },
  beltLength: { type: String, trim: true },
  outputRPM: { type: String, trim: true },
  noOfGroove: { type: String, trim: true },
  noOfGrooves: { type: String, trim: true },
  bearingType: { type: String, trim: true },
  pump_model: { type: String, trim: true },
  impellerType: { type: String, trim: true },
  rotationUnit: { type: String, trim: true },
  top_level: { type: Boolean, default: false },
  locationId: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  parent_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  description: { type: String, trim: true },
  manufacturer: { type: String, trim: true },
  year: { type: String, trim: true },
  qr_code: { type: String, trim: true },
  assigned_to: { type: Number, default: 1 },
  image_path: { type: String, trim: true },
  visible: { type: Boolean, default: true },
  brandMake: { type: String, trim: true },
  powerRating: { type: String, trim: true },
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
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const AssetModel = mongoose.model<IAsset>('Schema_Asset', assetSchema);
