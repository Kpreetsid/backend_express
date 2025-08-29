import mongoose, { Document, ObjectId, Schema } from "mongoose";

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
        name: { type: String, required: true },
        description: { type: String },
        account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
        locationId: { type: Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        json_temp: { type: Schema.Types.Mixed },
        visible: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        collection: "sops",
        timestamps: true,
        versionKey: false,
        toJSON: {
            virtuals: true,
            transform(doc: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                return ret;
            }
        },
        toObject: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                return ret;
            }
        }
    }
);

export const SOPsModel = mongoose.model<ISopsMaster>("Schema_SOPs", SopsMasterSchema);