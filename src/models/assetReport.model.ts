import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

const Created_From_Enum = ["Asset Report", "Asset Alarm"];
export const ASSET_REPORT_STATUS = ['Open', 'On-Hold', 'In-Progress', 'Completed'];

interface FaultData {
  value: number;
  name: string;
}

interface AssetHealthEntry {
  date: string;
  status: string;
}

interface RMSPoint {
  timestamp: number | string;
  rms: number | string;
}

interface RMSData {
  Axial?: RMSPoint;
  Horizontal?: RMSPoint;
  Vertical?: RMSPoint;
}

interface EndpointRMS {
  is_linked: boolean;
  composite_id: string;
  point_name: string;
  mount_location: string;
  mount_type?: string | null;
  mount_material?: string | null;
  mount_direction: string;
  asset_id: string;
  org_id: string;
  mac_id: string;
  image?: string | null;
  online?: boolean | null;
  asset_type?: string;
  acceleration?: RMSData;
  velocity?: RMSData;
  asset_name: string;
}

interface IStatusDetails {
  status: string;
  createdBy: ObjectId;
  createdAt: Date;
}

const StatusDetailsSchema = new Schema<IStatusDetails>({
  status: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false, versionKey: false });

export interface IReportAsset extends Document {
  accountId: ObjectId;
  top_level_asset_id: ObjectId;
  assetId: ObjectId;
  work_order_id: ObjectId;
  status: string;
  status_details: IStatusDetails[];
  Observations: string;
  observationId?: ObjectId;
  Recommendations: string;
  CreateWorkRequest: string;
  FaultDetected: string;
  Severity?: string;
  NewFault: string;
  ISO: boolean | string;
  TrendOfAlarm?: string;
  EquipmentHealth: string;
  files: object[];
  user: any;
  alarmId?: number;
  createdFrom?: string;
  chartDetail?: object[];
  userId: ObjectId;
  createdOn: Date;
  assetName?: string;
  locationId: ObjectId;
  locationName?: string;
  faultData: FaultData[];
  assetImage?: string;
  asset_health_history: AssetHealthEntry[];
  endpointRMSData: EndpointRMS[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

const reportAssetSchema = new Schema<IReportAsset>({
  accountId: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  assetId: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  work_order_id: { type: Schema.Types.ObjectId, ref: 'WorkOrderModel' },
  Observations: { type: String, trim: true },
  observationId: { type: Schema.Types.ObjectId, ref: 'ObservationModel' },
  Recommendations: { type: String, trim: true },
  CreateWorkRequest: { type: String, trim: true },
  FaultDetected: { type: String, trim: true },
  Severity: { type: String, trim: true },
  status: { type: String, trim: true, enum: ASSET_REPORT_STATUS, default: ASSET_REPORT_STATUS[0] },
  status_details: { type: [StatusDetailsSchema], default: [] },
  NewFault: { type: String, trim: true },
  ISO: { type: Schema.Types.Mixed },
  TrendOfAlarm: { type: String, trim: true },
  EquipmentHealth: { type: String, trim: true },
  files: { type: [Object], required: true },
  user: { type: Schema.Types.Mixed },
  userId: { type: Schema.Types.ObjectId, ref: 'UserModel' },
  alarmId: { type: Number },
  createdFrom: { type: String, enum: Created_From_Enum, trim: true, default: Created_From_Enum[0] },
  chartDetail: { type: [Object] },
  createdOn: { type: Date, default: Date.now },
  assetName: { type: String, trim: true },
  locationId: { type: Schema.Types.ObjectId, ref: 'LocationModel' },
  locationName: { type: String, trim: true },
  faultData: [{
    value: { type: Number },
    name: { type: String, trim: true }
  }],
  assetImage: { type: String, trim: true },
  asset_health_history: [{
    date: { type: String, trim: true },
    status: { type: String, trim: true }
  }],
  endpointRMSData: [{
    is_linked: { type: Boolean },
    composite_id: { type: String, trim: true },
    point_name: { type: String, trim: true },
    mount_location: { type: String, trim: true },
    mount_type: { type: String, trim: true, default: null },
    mount_material: { type: String, trim: true, default: null },
    mount_direction: { type: String, trim: true },
    asset_id: { type: String, trim: true },
    org_id: { type: String, trim: true },
    mac_id: { type: String, trim: true },
    image: { type: String, trim: true, default: null },
    online: { type: Boolean, default: null },
    asset_type: { type: String, trim: true },
    acceleration: {
      Axial: {
        timestamp: Schema.Types.Mixed,
        rms: Schema.Types.Mixed
      },
      Horizontal: {
        timestamp: Schema.Types.Mixed,
        rms: Schema.Types.Mixed
      },
      Vertical: {
        timestamp: Schema.Types.Mixed,
        rms: Schema.Types.Mixed
      }
    },
    velocity: {
      Axial: {
        timestamp: Schema.Types.Mixed,
        rms: Schema.Types.Mixed
      },
      Horizontal: {
        timestamp: Schema.Types.Mixed,
        rms: Schema.Types.Mixed
      },
      Vertical: {
        timestamp: Schema.Types.Mixed,
        rms: Schema.Types.Mixed
      }
    },
    asset_name: { type: String, trim: true }
  }],
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'assets-report',
  timestamps: true,
  versionKey: false,
  toJSON: { 
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        return ret;
      }
    }
});

export const ReportAssetModel = mongoose.model<IReportAsset>('Schema_ReportAsset', reportAssetSchema);
