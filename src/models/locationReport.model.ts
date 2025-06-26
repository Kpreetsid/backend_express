import mongoose, { Schema, Document, ObjectId } from 'mongoose';

const RMSDataSchema = new Schema({
    is_linked: Boolean,
    composite_id: String,
    point_name: String,
    mount_location: String,
    mount_type: String,
    mount_material: String,
    mount_direction: String,
    asset_id: Schema.Types.ObjectId,
    org_id: Schema.Types.ObjectId,
    mac_id: String,
    image: String,
    acceleration: {
        Axial: {
            timestamp: Number,
            rms: Number
        },
        Horizontal: {
            timestamp: Number,
            rms: Number
        },
        Vertical: {
            timestamp: Number,
            rms: Number
        }
    },
    velocity: {
        Axial: {
            timestamp: Number,
            rms: Number
        },
        Horizontal: {
            timestamp: Number,
            rms: Number
        },
        Vertical: {
            timestamp: Number,
            rms: Number
        }
    },
    asset_name: String
}, { _id: false });

const AssetHealthHistorySchema = new Schema({
    date: String,
    status: String
}, { _id: false });

const FaultDataSchema = new Schema({
    name: String,
    value: Number
}, { _id: false });

const AssetReportSchema = new Schema({
    asset_id: Schema.Types.ObjectId,
    observations: String,
    recommendations: String,
    created_on: Date,
    asset_name: String,
    location_name: String,
    fault_data: [FaultDataSchema],
    endpointRMSData: [RMSDataSchema],
    healthFlag: String,
    locationId: String,
    asset_health_history: [AssetHealthHistorySchema],
    dummyList: [AssetHealthHistorySchema]
}, { _id: false });

const SummaryDataSchema = new Schema({
    key: String,
    value: {
        value: Number,
        itemStyle: {
            color: String
        }
    }
}, { _id: false });

const FaultSummarySchema = new Schema({
    key: String,
    value: Number
}, { _id: false });

const SubLocationAssetSchema = new Schema({
    asset_id: Schema.Types.ObjectId,
    observations: String,
    recommendations: String,
    created_on: Date,
    asset_name: String,
    location_name: String,
    fault_data: [FaultDataSchema],
    endpointRMSData: [RMSDataSchema],
    healthFlag: String,
    locationId: String,
    asset_health_history: [AssetHealthHistorySchema],
    dummyList: [AssetHealthHistorySchema]
}, { _id: false });

const SubLocationSchema = new Schema({
    sub_location: {
        id: String,
        name: String
    },
    asset_data: [SubLocationAssetSchema],
    sub_location_asset_condition_summary_data: [SummaryDataSchema],
    sub_location_asset_fault_summary_data: [FaultSummarySchema]
}, { _id: false });

const UserSchema = new Schema({
    firstName: String,
    lastName: String,
    username: String,
    email: String,
    emailStatus: Boolean,
    user_status: String,
    user_role: String,
    createdOn: Date,
    id: String,
    account_id: String,
    phone_no: {
        number: String,
        internationalNumber: String,
        nationalNumber: String,
        e164Number: String,
        countryCode: String,
        dialCode: String
    },
    isFirstUser: Boolean
}, { _id: false });

export interface ILocationReport {
    asset_condition_summary_data: any;
    asset_fault_summary_data: any;
    asset_report_data: any;
    created_on: Date;
    account_id: ObjectId;
    sub_location_data: any;
    user: any;
    location_id: ObjectId;
}
  

const LocationReportSchema = new Schema<ILocationReport>({
    asset_condition_summary_data: { type: [SummaryDataSchema]},
    asset_fault_summary_data: { type: [FaultSummarySchema] },
    asset_report_data: { type: [AssetReportSchema] },
    created_on: { type: Date, default: Date.now },
    account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    sub_location_data: { type: [SubLocationSchema] },
    user: { type: UserSchema },
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true }
},
    {
        collection: 'location-report',
        timestamps: true,
        versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
    }
);

export const LocationReport = mongoose.model<ILocationReport>('LocationReport', LocationReportSchema);
