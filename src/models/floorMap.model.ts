import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export const FLOOR_MAP_DATA_TYPES = ['location', 'asset', 'kpi'];

interface ICoordinate {
  x: number;
  y: number;
}

interface IEndPoint {
  is_linked: boolean;
  composite_id: string;
  point_name: string;
  mount_location: string;
  mount_type?: string | null;
  mount_material?: string | null;
  mount_direction: string;
  asset_id: ObjectId | string;
  asset_name: string;
  org_id: ObjectId | string;
  mac_id: string;
  image?: string | null;
  online: string;
  id: number;
  selected: boolean;
}

export interface IEndpointLocation extends Document {
  coordinate: ICoordinate;
  locationId: ObjectId;
  account_id: ObjectId;
  data_type: string;
  createdOn: Date;
  end_point_id: number;
  end_point: IEndPoint;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const coordinateSchema = new Schema<ICoordinate>({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
}, { _id: false });

const endPointSchema = new Schema<IEndPoint>({
  is_linked: { type: Boolean },
  composite_id: { type: String },
  point_name: { type: String, required: true },
  mount_location: { type: String },
  mount_type: { type: String },
  mount_material: { type: String },
  mount_direction: { type: String },
  asset_id: { type: mongoose.Schema.Types.Mixed },
  asset_name: { type: String, required: true },
  org_id: { type: mongoose.Schema.Types.Mixed, required: true },
  mac_id: { type: String },
  image: { type: String },
  online: { type: String },
  id: { type: Number, required: true },
  selected: { type: Boolean }
}, { _id: false });

const endpointLocationSchema = new Schema<IEndpointLocation>({
  coordinate: { type: coordinateSchema, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  data_type: { type: String, enum: FLOOR_MAP_DATA_TYPES, required: true },
  createdOn: { type: Date, default: Date.now },
  end_point_id: { type: Number },
  end_point: { type: endPointSchema },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'floor_map',
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

export const EndpointLocationModel = mongoose.model<IEndpointLocation>('Schema_EndPoints', endpointLocationSchema);
