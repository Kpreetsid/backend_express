import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { IUpload, uploadSchema } from './upload.model';

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

export interface IReportAsset extends Document {
  accountId: ObjectId;
  top_level_asset_id: ObjectId;
  assetId: ObjectId;
  Observations: string;
  Recommendations: string;
  CreateWorkRequest: string;
  FaultDetected: string;
  Severity?: string;
  NewFault: string;
  ISO: boolean | string;
  TrendOfAlarm?: string;
  EquipmentHealth: string;
  files: [IUpload];
  user: any;
  userId: ObjectId;
  createdOn: Date;
  assetName?: string;
  locationId: ObjectId;
  locationName?: string;
  faultData: FaultData[];
  assetImage?: string;
  asset_health_history: AssetHealthEntry[];
  endpointRMSData: EndpointRMS[];
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

const reportAssetSchema = new Schema<IReportAsset>({
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
  assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
  Observations: { type: String },
  Recommendations: { type: String },
  CreateWorkRequest: { type: String },
  FaultDetected: { type: String },
  Severity: { type: String },
  NewFault: { type: String },
  ISO: { type: Schema.Types.Mixed },
  TrendOfAlarm: { type: String },
  EquipmentHealth: { type: String },
  files: { type: [uploadSchema], default: [] },
  user: { type: Schema.Types.Mixed },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  createdOn: { type: Date, default: Date.now },
  assetName: { type: String },
  locationId: { type: Schema.Types.ObjectId, ref: 'LocationMaster' },
  locationName: { type: String },
  faultData: [{
    value: { type: Number },
    name: { type: String }
  }],
  assetImage: { type: String },
  asset_health_history: [{
    date: { type: String },
    status: { type: String }
  }],
  endpointRMSData: [{
    is_linked: { type: Boolean },
    composite_id: { type: String },
    point_name: { type: String },
    mount_location: { type: String },
    mount_type: { type: String, default: null },
    mount_material: { type: String, default: null },
    mount_direction: { type: String },
    asset_id: { type: String },
    org_id: { type: String },
    mac_id: { type: String },
    image: { type: String, default: null },
    online: { type: Boolean, default: null },
    asset_type: { type: String },
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
    asset_name: { type: String }
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  collection: 'assets-report',
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

export const ReportAssetModel = mongoose.model<IReportAsset>('ReportAsset', reportAssetSchema);
