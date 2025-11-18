import mongoose, { Schema, Document } from 'mongoose';

export const STATUS = ['active', 'inactive'];

export interface IAccount extends Document {
  account_name: string;
  type: string;
  description: string;
  fileName?: string;
  account_status: string;
  visible: boolean;
}

const accountSchema = new Schema<IAccount>(
  {
    account_name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, trim: true, required: true },
    description: { type: String, trim: true},
    fileName: { type: String, trim: true },
    account_status: { type: String, trim: true, enum: STATUS, default: 'active' },
    visible: { type: Boolean, required: true, default: true }
  },
  {
    collection: 'account_master',
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const AccountModel = mongoose.model<IAccount>('Schema_Account', accountSchema);