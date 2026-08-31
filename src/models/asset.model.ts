import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const ASSET_COLLECTION_NAME = `asset_master`;
export const ASSETS_TYPE = ['Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox', 'Fan_Blower', 'Pumps', 'Compressor', 'Chillers', 'CNC', 'Other'];

export interface IAsset extends Document {
  asset_name: string;
  asset_id: string;
  asset_type: string;
  asset_model: string;
  asset_orient?: string;
  asset_behavior?: string;
  asset_frequency?: string;
  asset_class?: string;
  asset_timezone: string;
  asset_build_type: string;
  isNewFlow: boolean;
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
  alarmType: string[];
  brand: string;
  mountType: string;
  // specificFrequency: string[];
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
  shaft_1_driving_teeth?: number,
  shaft_2_driving_teeth?: number,
  shaft_2_driven_teeth?: number,
  shaft_3_driving_teeth?: number,
  shaft_3_driven_teeth?: number,
  shaft_4_driving_teeth?: number,
  shaft_4_driven_teeth?: number,
  shaft_5_driven_teeth?: number,
  isBuzzerActive: boolean,
  snoozeAlarm?: boolean,
  snoozeValue?: number,
  createdBy: ObjectId;
  updatedBy: ObjectId;
  motorRatedEfficiencyPercent?: number;
  vfdDriven?: boolean;
  ratedCurrentA?: number;
  ratedVoltageV?: number;
  nominalPowerFactor?: number;
  ratedFlowM3h?: number;
  ratedHeadM?: number;
  bepFlowM3h?: number;
  bepHeadM?: number;
  bepEfficiencyPercent?: number;
  minimumContinuousStableFlowM3h?: number;
  motorToPumpSpeedRatio?: number;
  images: Object[];
}

const assetSchema = new Schema<IAsset>(
  {
    asset_name: { type: String, required: true, trim: true },
    asset_id: { type: String, trim: true },
    asset_type: { type: String, trim: true, enum: ASSETS_TYPE, required: true },
    asset_model: { type: String, trim: true },
    asset_orient: { type: String, trim: true },
    asset_behavior: { type: String, trim: true },
    asset_frequency: { type: String, trim: true },
    asset_class: { type: String, trim: true },
    asset_timezone: {
      type: String,
      trim: true,
      default: () => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return tz && tz !== "UTC" ? tz : "Asia/Kolkata";
      },
    },
    asset_build_type: { type: String, trim: true },
    imageNodeData: { type: Object },
    isNewFlow: { type: Boolean },
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
    alarmType: { type: [String], default: ["alert", "danger", "critical"] },
    brandModel: { type: String, trim: true },
    pinionGearTeethCount: { type: String, trim: true },
    timingGearTeethCount: { type: String, trim: true },
    minInputRotation: { type: String, trim: true },
    maxInputRotation: { type: String, trim: true },
    rotation_type: { type: String, trim: true },
    mountType: { type: String, trim: true },
    // specificFrequency: { type: [String] },
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
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "LocationModel",
      required: true,
    },
    account_id: {
      type: Schema.Types.ObjectId,
      ref: "AccountModel",
      required: true,
    },
    top_level_asset_id: { type: Schema.Types.ObjectId, ref: "AssetModel" },
    parent_id: { type: Schema.Types.ObjectId, ref: "AssetModel" },
    description: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    year: { type: String, trim: true },
    qr_code: { type: String, trim: true },
    assigned_to: { type: Number, default: 1 },
    image_path: { type: String, trim: true },
    brandMake: { type: String, trim: true },
    powerRating: { type: String, trim: true },
    noStages: { type: Number },
    shaft_1_driving_teeth: { type: Number },
    shaft_2_driving_teeth: { type: Number },
    shaft_2_driven_teeth: { type: Number },
    shaft_3_driving_teeth: { type: Number },
    shaft_3_driven_teeth: { type: Number },
    shaft_4_driving_teeth: { type: Number },
    shaft_4_driven_teeth: { type: Number },
    shaft_5_driven_teeth: { type: Number },
    isBuzzerActive: { type: Boolean, default: false },
    snoozeAlarm: { type: Boolean, default: false },
    snoozeValue: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserModel" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserModel" },
    motorRatedEfficiencyPercent: { type: Number },
    vfdDriven: { type: Boolean },
    ratedCurrentA: { type: Number },
    ratedVoltageV: { type: Number },
    nominalPowerFactor: { type: Number },
    ratedFlowM3h: { type: Number },
    ratedHeadM: { type: Number },
    bepFlowM3h: { type: Number },
    bepHeadM: { type: Number },
    bepEfficiencyPercent: { type: Number },
    minimumContinuousStableFlowM3h: { type: Number },
    motorToPumpSpeedRatio: { type: Number },
    images: { type: [Object], default: [] }
  },
  {
    collection: ASSET_COLLECTION_NAME,
    timestamps: true,
    versionKey: false,
  },
);

assetSchema.index({ account_id: 1, visible: 1 });
assetSchema.index({ parent_id: 1 });
assetSchema.index({ locationId: 1 });
assetSchema.index({ top_level_asset_id: 1 });

export const AssetModel = mongoose.model<IAsset>('Schema_Asset', assetSchema);
