import mongoose, { Document, Schema } from "mongoose";
import { ObjectId } from 'mongodb';
export const SETTINGS_COLLECTION_NAME = 'app_settings';
export const REDIS_ENUM = ['enabled', 'disabled'];

export interface ISettingsMaster extends Document {
    account_id: ObjectId;
    name: string;
    description: string;
    redis_status: string;
    visible: boolean;
    createdBy: ObjectId;
    updatedBy?: ObjectId;
}

const SettingsSchema = new Schema<ISettingsMaster>(
    {
        account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
        name: { type: String, trim: true, required: true },
        description: { type: String, trim: true },
        redis_status: { type: String, trim: true, enum: REDIS_ENUM, default: REDIS_ENUM[0] },
        visible: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
    },
    {
        collection: SETTINGS_COLLECTION_NAME,
        timestamps: true,
        versionKey: false
    }
);

export const SettingsModel = mongoose.model<ISettingsMaster>("Schema_Settings", SettingsSchema);