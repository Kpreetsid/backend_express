import mongoose, { Schema, Document } from 'mongoose';

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
  asset_id: mongoose.Types.ObjectId | string;
  org_id: mongoose.Types.ObjectId | string;
  mac_id: string;
  image?: string | null;
  online: string;
  id: number;
  selected: boolean;
}

export interface IEndpointLocation extends Document {
  coordinate: ICoordinate;
  locationId: mongoose.Types.ObjectId;
  account_id: mongoose.Types.ObjectId;
  data_type: string;
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
  mount_type: { type: String, default: null },
  mount_material: { type: String, default: null },
  mount_direction: { type: String, required: true },
  asset_id: { type: mongoose.Schema.Types.Mixed, required: true },
  org_id: { type: mongoose.Schema.Types.Mixed, required: true },
  mac_id: { type: String, required: true },
  image: { type: String, default: null },
  online: { type: String, required: true },
  id: { type: Number, required: true },
  selected: { type: Boolean, required: true },
});

const endpointLocationSchema = new Schema<IEndpointLocation>({
  coordinate: { type: coordinateSchema, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  data_type: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  end_point_id: { type: Number, required: true },
  end_point: { type: endPointSchema, required: true },
}, {
  collection: 'floor_map',
  timestamps: false 
});

export const EndpointLocation = mongoose.model<IEndpointLocation>('EndpointLocation', endpointLocationSchema);
