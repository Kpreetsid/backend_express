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
    versionKey: false
  }
);

export const Account = mongoose.model<IAccount>('Account', accountSchema);

export const getAllAccount = async () => await Account.find({ isActive: true });

export const getAccountByFilter = async (filter: any) => await Account.find({filter, isActive: true });

export const getAccountByID = async (id: string) => await Account.findById(id);

export const getAccountByName = async (name: string) => await Account.findOne({ name, isActive: true });

export const createAccount = async (data: IAccount) => await new Account(data).save();

export const updateAccount = async (id: string, data: IAccount) => await Account.findByIdAndUpdate(id, data);

export const removeAccount = async (id: string) => await Account.findByIdAndUpdate(id, { isActive: false });