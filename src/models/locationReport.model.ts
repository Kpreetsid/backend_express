import mongoose, { Schema, ObjectId } from 'mongoose';

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
            timestamp: { type: Schema.Types.Mixed },
            rms: { type: Schema.Types.Mixed }
        },
        Horizontal: {
            timestamp: { type: Schema.Types.Mixed },
            rms: { type: Schema.Types.Mixed }
        },
        Vertical: {
            timestamp: { type: Schema.Types.Mixed },
            rms: { type: Schema.Types.Mixed }
        }
    },
    velocity: {
        Axial: {
            timestamp: { type: Schema.Types.Mixed },
            rms: { type: Schema.Types.Mixed }
        },
        Horizontal: {
            timestamp: { type: Schema.Types.Mixed },
            rms: { type: Schema.Types.Mixed }
        },
        Vertical: {
            timestamp: { type: Schema.Types.Mixed },
            rms: { type: Schema.Types.Mixed }
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
    isActive: boolean;
    createdBy: ObjectId;
    updatedBy?: ObjectId
}


const LocationReportSchema = new Schema<ILocationReport>({
    asset_condition_summary_data: { type: [SummaryDataSchema] },
    asset_fault_summary_data: { type: [FaultSummarySchema] },
    asset_report_data: { type: [AssetReportSchema] },
    created_on: { type: Date, default: Date.now },
    account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    sub_location_data: { type: [SubLocationSchema] },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    user: { type: Schema.Types.Mixed },
    location_id: { type: Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
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
});

export const LocationReport = mongoose.model<ILocationReport>('LocationReport', LocationReportSchema);
