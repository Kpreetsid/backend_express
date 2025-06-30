import mongoose, { Schema, Document, ObjectId } from 'mongoose';

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
  createdBy: ObjectId;
  createdOn: Date;
  end_point_id: number;
  end_point: IEndPoint;
}

const coordinateSchema = new Schema<ICoordinate>({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
});

const endPointSchema = new Schema<IEndPoint>({
  is_linked: { type: Boolean, required: true },
  composite_id: { type: String, required: true },
  point_name: { type: String, required: true },
  mount_location: { type: String, required: true },
  mount_type: { type: String },
  mount_material: { type: String },
  mount_direction: { type: String, required: true },
  asset_id: { type: mongoose.Schema.Types.Mixed, required: true },
  org_id: { type: mongoose.Schema.Types.Mixed, required: true },
  mac_id: { type: String, required: true },
  image: { type: String },
  online: { type: String, required: true },
  id: { type: Number, required: true },
  selected: { type: Boolean, required: true }
}, { _id: false });

const endpointLocationSchema = new Schema<IEndpointLocation>({
  coordinate: { type: coordinateSchema, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  data_type: { type: String, enum: ['location', 'asset', 'kpi'], required: true },
  createdOn: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  end_point_id: { type: Number },
  end_point: { type: endPointSchema }
}, {
  collection: 'floor_map',
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

export const EndpointLocation = mongoose.model<IEndpointLocation>('EndpointLocation', endpointLocationSchema);
