import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationData {
    location_name: string;
    id: string;
}

export interface IAsset extends mongoose.Document {
    asset_name: string;
    asset_id: string;
    top_level: boolean;
    locationId: mongoose.Types.ObjectId;
    account_id: mongoose.Types.ObjectId;
    top_level_asset_id: mongoose.Types.ObjectId;
    description: string;
    asset_model: string; // renamed from model
    manufacturer: string;
    asset_type: string;
    year: string;
    qr_code: string;
    teamId: string | null;
    assigned_to: number;
    locationData: {
      location_name: string;
      id: string;
    }[];
    locationName: string;
    equipment_id: string;
    id: mongoose.Types.ObjectId;
    image_path: string;
    visible: boolean;
}  

const assetSchema = new Schema<IAsset>({
  asset_name: { type: String, required: true },
  asset_id: { type: String, default: "" },
  top_level: { type: Boolean, default: false },
  locationId: { type: Schema.Types.ObjectId, required: true },
  account_id: { type: Schema.Types.ObjectId, required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, required: true },
  description: { type: String, default: "" },
  asset_model: { type: String, default: "" },
  manufacturer: { type: String, default: "" },
  asset_type: { type: String, required: true },
  year: { type: String, default: "" },
  qr_code: { type: String, required: true },
  teamId: { type: String, default: null },
  assigned_to: { type: Number, required: true },
  locationData: [
    {
      location_name: { type: String, required: true },
      id: { type: String, required: true },
    }
  ],
  locationName: { type: String, required: true },
  equipment_id: { type: String, default: "" },
  id: { type: Schema.Types.ObjectId, required: true },
  image_path: { type: String, required: true },
  visible: { type: Boolean, default: true },
}, {
  collection: 'assets',
  timestamps: true
});

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);
