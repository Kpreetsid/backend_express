import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ITeam extends Document {
  account_id: ObjectId;
  team_name: string;
  description?: string;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const teamSchema = new Schema<ITeam>(
  {
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
    team_name: { type: String, required: true },
    description: { type: String },
    visible: { type: Boolean, required: true, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
  },
  {
    collection: 'team',
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

export const TeamsModel = mongoose.model<ITeam>('Schema_Team', teamSchema);