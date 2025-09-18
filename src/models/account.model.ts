import mongoose, { Schema, Document } from 'mongoose';

export const STATUS = ['active', 'inactive'];

export interface IAccount extends Document {
  account_name: string;
  type: string;
  description: string;
  fileName?: string;
  account_status: string;
  isActive: boolean;
  visible: boolean;
}

const accountSchema = new Schema<IAccount>(
  {
    account_name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String},
    fileName: { type: String },
    account_status: { type: String, enum: STATUS, default: 'active' },
    isActive: { type: Boolean, required: true, default: true },
    visible: { type: Boolean, required: true, default: true }
  },
  {
    collection: 'account_master',
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const AccountModel = mongoose.model<IAccount>('Schema_Account', accountSchema);