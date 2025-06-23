import mongoose, { Schema, Document } from 'mongoose';

export interface IAccount extends Document {
  account_name: string;
  type: string;
  description: string;
  account_status: string;
  isActive: boolean;
}

const accountSchema = new Schema<IAccount>(
  {
    account_name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String},
    account_status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    collection: 'account_master',
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        return ret;
      }
     }
  }
);

export const Account = mongoose.model<IAccount>('Account', accountSchema);