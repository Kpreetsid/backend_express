import mongoose, { Schema, ObjectId } from 'mongoose';

const rmsSchema = new Schema({
    timestamp: { type: Schema.Types.Mixed },
    rms: { type: Schema.Types.Mixed }
}, { _id: false });

const accelerationVelocitySchema = new Schema({
    Axial: { type: rmsSchema },
    Horizontal: { type: rmsSchema },
    Vertical: { type: rmsSchema }
}, { _id: false });

const RMSDataSchema = new Schema({
    is_linked: Boolean,
    composite_id: { type: String },
    point_name: { type: String },
    mount_location: { type: String },
    mount_type: { type: String },
    mount_material: { type: String },
    mount_direction: { type: String },
    asset_id: Schema.Types.ObjectId,
    org_id: Schema.Types.ObjectId,
    mac_id: { type: String },
    image: { type: String },
    acceleration: accelerationVelocitySchema,
    velocity: accelerationVelocitySchema,
    asset_name: String
}, { _id: false });

const AssetHealthHistorySchema = new Schema({
    date: { type: String },
    status: String
}, { _id: false });

const FaultDataSchema = new Schema({
    name: { type: String },
    value: Number
}, { _id: false });

const AssetReportSchema = new Schema({
    asset_id: Schema.Types.ObjectId,
    observations: { type: String },
    recommendations: { type: String },
    created_on: { type: Date },
    asset_name: { type: String },
    location_name: { type: String },
    fault_data: [FaultDataSchema],
    endpointRMSData: [RMSDataSchema],
    healthFlag: { type: String },
    locationId: { type: String },
    asset_health_history: [AssetHealthHistorySchema],
    dummyList: { type: Schema.Types.Mixed }
}, { _id: false });

const SummaryDataSchema = new Schema({
    key: { type: String },
    value: {
        value: Number,
        itemStyle: {
            color: String
        }
    }
}, { _id: false });

const FaultSummarySchema = new Schema({
    key: { type: String },
    value: Number
}, { _id: false });

const SubLocationAssetSchema = new Schema({
    asset_id: { type: Schema.Types.ObjectId },
    observations: { type: String },
    recommendations: { type: String },
    created_on: { type: Date },
    asset_name: { type: String },
    location_name: { type: String },
    fault_data: { type: [FaultDataSchema] },
    endpointRMSData: { type: [RMSDataSchema] },
    healthFlag: { type: String },
    locationId: { type: String },
    asset_health_history: { type: [AssetHealthHistorySchema] },
    dummyList: { type: Schema.Types.Mixed }
}, { _id: false });

const SubLocationSchema = new Schema({
    sub_location: {
        id: { type: String },
        name: { type: String }
    },
    asset_data: { type: [SubLocationAssetSchema] },
    sub_location_asset_condition_summary_data: { type: [SummaryDataSchema] },
    sub_location_asset_fault_summary_data: { type: [FaultSummarySchema] }
}, { _id: false });

export interface ILocationReport {
    asset_condition_summary_data: any;
    asset_fault_summary_data: any;
    asset_report_data: any;
    created_on: Date;
    account_id: ObjectId;
    sub_location_data: any;
    user: any;
    userId: ObjectId;
    location_id: ObjectId;
    visible: boolean;
    createdBy: ObjectId;
    updatedBy?: ObjectId
}

const LocationReportSchema = new Schema<ILocationReport>({
    asset_condition_summary_data: { type: [SummaryDataSchema] },
    asset_fault_summary_data: { type: [FaultSummarySchema] },
    asset_report_data: { type: [AssetReportSchema] },
    created_on: { type: Date, default: Date.now },
    account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
    sub_location_data: { type: [SubLocationSchema] },
    userId: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
    user: { type: Schema.Types.Mixed },
    location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
    visible: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
}, {
    collection: 'location-report',
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

export const ReportLocationModel = mongoose.model<ILocationReport>('Schema_ReportLocation', LocationReportSchema);
