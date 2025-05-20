import mongoose, { Schema, ObjectId } from 'mongoose';

export interface ILocationData {
  location_name: string;
  id: string;
  assigned_to?: string;
}

export interface IAsset extends mongoose.Document {
  asset_name: string;
  asset_id: string;
  top_level: boolean;
  locationId?: ObjectId; 
  location_id?: string; 
  account_id: ObjectId;
  top_level_asset_id: ObjectId;
  parent_id?: ObjectId;
  parent_name?: string;
  description: string;
  asset_model?: string;
  asset_model_name?: string;
  manufacturer: string;
  asset_type: string;
  year: string;
  qr_code: string;
  teamId: string | null;
  assigned_to: number;
  locationData: ILocationData[];
  locationName: string;
  equipment_id?: string;
  id?: ObjectId;
  image_path?: string;
  visible: boolean;
  isActive: boolean;
}

const assetSchema = new Schema<IAsset>({
  asset_name: { type: String, required: true },
  asset_id: { type: String, default: '' },
  top_level: { type: Boolean, default: false },
  locationId: { type: Schema.Types.ObjectId },
  location_id: { type: String },
  account_id: { type: Schema.Types.ObjectId, required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, required: true },
  parent_id: { type: Schema.Types.ObjectId, default: null },
  parent_name: { type: String, default: '' },
  description: { type: String, default: '' },
  asset_model: { type: String, default: '' },
  asset_model_name: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  asset_type: { type: String, required: true },
  year: { type: String, default: '' },
  qr_code: { type: String, default: '' },
  teamId: { type: String, default: null },
  assigned_to: { type: Number, required: true },
  locationData: [
    {
      location_name: { type: String, required: true },
      id: { type: String, required: true },
      assigned_to: { type: String, required: false },
    },
  ],
  locationName: { type: String, required: true },
  equipment_id: { type: String, default: '' },
  id: { type: Schema.Types.ObjectId },
  image_path: { type: String, default: '' },
  visible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, {
  collection: 'asset_master',
  timestamps: true,
  versionKey: false
});

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);

export const getAllAssets = async (accountId: ObjectId) => await Asset.find({ account_id: accountId, visible: true }).sort({ _id: -1 });

export const getAssetById = async (id: string) => await Asset.findById(id);

export const getFilteredAssets = async (filter: Record<string, any>) => await Asset.find({filter, visible: true }).sort({ _id: -1 });

export const createAsset = async (asset: IAsset) => await Asset.create(asset);

export const updateAsset = async (id: string, asset: IAsset) => await Asset.findByIdAndUpdate(id, asset);

export const deleteAsset = async (id: string) => await Asset.findByIdAndUpdate(id, { visible: false });
