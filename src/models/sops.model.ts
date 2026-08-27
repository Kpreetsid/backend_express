import mongoose, { Document, Schema } from "mongoose";
import { ObjectId } from 'mongodb';
export const SOPS_COLLECTION_NAME = 'sops';


export interface ISopsMaster extends Document {
    name: string;
    visible: boolean;
    json_temp: any;
    account_id: ObjectId;
    locationId: ObjectId;
    categoryId: ObjectId;
    description: string;
    createdBy: ObjectId;
    updatedBy?: ObjectId;
}

const SopsMasterSchema = new Schema<ISopsMaster>(
    {
        name: { type: String, trim: true, required: true },
        description: { type: String, trim: true },
        account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
        locationId: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'CategoryModel', required: true },
        json_temp: { type: Schema.Types.Mixed },
        visible: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
    },
    {
        collection: SOPS_COLLECTION_NAME,
        timestamps: true,
        versionKey: false
    }
);

SopsMasterSchema.index({ account_id: 1, visible: 1 });
SopsMasterSchema.index({ account_id: 1, locationId: 1 });

export const SOPsModel = mongoose.model<ISopsMaster>("Schema_SOPs", SopsMasterSchema);