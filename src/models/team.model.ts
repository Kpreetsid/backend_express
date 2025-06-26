import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ITeam extends Document {
  team_name: string;
  account_id: ObjectId;
  createdBy: ObjectId;
  isActive: boolean;
}

const teamSchema = new Schema<ITeam>(
  {
    team_name: { type: String, required: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    collection: 'team',
    timestamps: true,
    versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
  }
);

export const Teams = mongoose.model<ITeam>('Team', teamSchema);