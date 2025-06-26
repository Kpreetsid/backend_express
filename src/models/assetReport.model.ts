import mongoose, { Schema, Document, ObjectId } from 'mongoose';

interface FaultData {
  value: number;
  name: string;
}

interface AssetHealthEntry {
  date: string;
  status: string;
}

interface DirectionalRMS {
  timestamp: number;
  rms: number;
}

interface RMSData {
  Axial?: DirectionalRMS;
  Horizontal?: DirectionalRMS;
  Vertical?: DirectionalRMS;
}

interface EndpointRMS {
  is_linked: boolean;
  composite_id: string;
  point_name: string;
  mount_location: string;
  mount_type: string;
  mount_material: string;
  mount_direction: string;
  asset_id: string;
  org_id: string;
  mac_id: string;
  image?: string | null;
  acceleration?: RMSData;
  velocity?: RMSData;
  asset_name: string;
}

interface PhoneNo {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailStatus: boolean;
  user_status: string;
  user_role: string;
  createdOn: Date;
  id: string;
  account_id: string;
  phone_no: PhoneNo;
  isFirstUser: boolean;
}

export interface IReportAsset extends Document {
  top_level_asset_id: ObjectId;
  Observations: string;
  Recommendations: string;
  CreateWorkRequest: string;
  FaultDetected: string;
  Severity: string;
  NewFault: string;
  ISO: string;
  TrendOfAlarm: string;
  EquipmentHealth: string;
  files: string[];
  user: UserInfo;
  createdOn: Date;
  assetName: string;
  locationId: string;
  locationName: string;
  accountId: string;
  faultData: FaultData[];
  assetImage: string;
  asset_health_history: AssetHealthEntry[];
  endpointRMSData: EndpointRMS[];
}

const reportAssetSchema = new Schema<IReportAsset>({
  top_level_asset_id: { type: Schema.Types.ObjectId, required: true },
  Observations: String,
  Recommendations: String,
  CreateWorkRequest: String,
  FaultDetected: String,
  Severity: String,
  NewFault: String,
  ISO: String,
  TrendOfAlarm: String,
  EquipmentHealth: String,
  files: [String],
  user: {
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
  },
  createdOn: { type: Date, default: Date.now },
  assetName: String,
  locationId: String,
  locationName: String,
  accountId: String,
  faultData: [{
    value: Number,
    name: String
  }],
  assetImage: String,
  asset_health_history: [{
    date: String,
    status: String
  }],
  endpointRMSData: [{
    is_linked: Boolean,
    composite_id: String,
    point_name: String,
    mount_location: String,
    mount_type: String,
    mount_material: String,
    mount_direction: String,
    asset_id: String,
    org_id: String,
    mac_id: String,
    image: { type: String },
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
  }]
}, {
  collection: 'assets-report',
  timestamps: false ,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
});

export const ReportAsset = mongoose.model<IReportAsset>('ReportAsset', reportAssetSchema);
