import mongoose, { Schema, Document } from 'mongoose';

export interface IAccount extends Document {
  name: string;
  isActive: boolean;
  type: string;
  description: string;
}

const accountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true },
    type: { type: String, required: true },
    description: { type: String}
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