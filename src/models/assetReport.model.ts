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
  work_order_id: ObjectId;
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
  Recommendations: { type: String, trim: true },
  CreateWorkRequest: { type: String, trim: true },
  FaultDetected: { type: String, trim: true },
  Severity: { type: String, trim: true },
  NewFault: { type: String, trim: true },
  ISO: { type: Schema.Types.Mixed },
  TrendOfAlarm: { type: String, trim: true },
  EquipmentHealth: { type: String, trim: true },
  files: { type: [uploadSchema], default: [] },
  user: { type: Schema.Types.Mixed },
  userId: { type: Schema.Types.ObjectId, ref: 'UserModel' },
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
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const ReportAssetModel = mongoose.model<IReportAsset>('Schema_ReportAsset', reportAssetSchema);
