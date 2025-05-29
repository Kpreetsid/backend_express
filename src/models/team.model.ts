import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  account_id: ObjectId;
  isActive: boolean;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    collection: 'team',
    timestamps: true,
    versionKey: false
  }
);

export const Teams = mongoose.model<ITeam>('Team', teamSchema);